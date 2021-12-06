/**
 * use keyframe and interpolate to accompish movement animation
 * @description bind SendKeyframeQueue.onInterpolateMessage and SendKeyframeQueue.send for communicate between hardware and program
 */

namespace softrobot.movement {
    // storage
    export interface IMapContents<T> {
        [key: number]: T
    }
    export class MyMap<T> {
        private MAX_SIZE = 100;
        public contents: IMapContents<T> = {};
        private size = 0;
        private currentKey: number = -1;
        private keyGenerator(): number {
        while (!!this.contents[++this.currentKey]) {
            if (this.currentKey == this.MAX_SIZE - 1) this.currentKey = -1;
        }
        return this.currentKey;
        }
        /**
        * add content to the map
        * @param content the content to be added into the map
        * @returns the key of the added content, return -1 if its full
        */
        push(content: T): number {
        if (this.size == this.MAX_SIZE) return -1;
        let key = this.keyGenerator();
        this.contents[key] = content;
        return key;
        }
        /**
        * delete one content from the map
        * @param key the key of the content
        */
        remove(key: number) {
        this.contents[key] = undefined;
        }
        /**
        * clear all contents in the map
        */
        clear() {
        this.contents = {};
        }
        /**
        * get the content in the map with key
        * @param key the key of the content
        */
        find(key: number): T {
        return this.contents[key];
        }
        /**
        * map
        * @param callback callback function called for every content
        */
        map(callback: (val?: T, key?: number) => void) {
        for (let key in this.contents) {
            if (!!this.contents[key]) callback(this.contents[key], parseInt(key));
        }
        }
    }

    // keyframe to specify pose for all motors
    export interface IKeyframe {
        pose: number[];         // poses for all motors
        period: number;         // time to interpolate to this keyframe
    }

    export interface SendKeyframeQueueParams {
        stuckChecker?: boolean;         // enable checker to periodically check whether queue have been dequeued, default: false
        sender: (data: any) => void;
        receiver: (() => void)[];
        canPush: (data: any) => boolean;
        canSend: (data: any) => boolean;
    }

    /**
     * keyframes in queue wait to be sent to hardware
     */
    export class SendKeyframeQueue {
        private static MAX_SIZE = 20;           // the queue could only contains MAX_SIZE array elements
        private static REMOTE_MAX_SIZE = 6;     // keep the keyframes on softrobot <= REMOTE_MAX_SIZE
        private static STUCK_CHECKER_INTERVAL = 2000;   // interval (ms) between two stuck check
        private static BLOCK_QUERY_TIME = 1000; // can not send two query in BLOCK_QUERY_TIME (ms)

        private queue: IKeyframe[] = [];
        private blockQuery: boolean = false;    // unable to query to prevent too much query packet 
        private isWantQuery: boolean = false;   // when [blockQuery] is true and want query after block
        private remoteVacancy: number = 0;
        private lastTimeWriteCount = 0;

        /**
         *  sync visual representation of motors with Nuibot
         */
        public onCountReadMinChange: MyMap<(id: number) => void> = new MyMap<(id: number) => void>();
        private curCountReadMin = -1;
        private p_keyframeId_start: number = 0;
        private p_keyframeId_send: number = 0;      // id of the next keyframe to be sent 
        private p_keyframeId_end: number = 0;
        private MAP_SIZE: number = SendKeyframeQueue.MAX_SIZE + SendKeyframeQueue.REMOTE_MAX_SIZE + 1;
        private writeCountMap: number[] = new Array<number>(this.MAP_SIZE);       // map: (key: keyframe id --- val: count of write)
        private keyframeIdGenerator(): number {
            let res = this.p_keyframeId_end;
            this.p_keyframeId_end = this.addPKeyframeId(this.p_keyframeId_end);
            return res;
        }
        private updateCountRead(countReadMin: number) {
            if (countReadMin == this.curCountReadMin) return;
            else this.curCountReadMin = countReadMin;

            let nextId = this.p_keyframeId_start;
            while (this.writeCountMap[nextId] != countReadMin && nextId != this.p_keyframeId_end) {
                nextId = this.addPKeyframeId(nextId);
            }
            if (nextId == this.p_keyframeId_end) return;    // not found
            else {
                this.p_keyframeId_start = nextId;

                // call registered callbacks
                this.onCountReadMinChange.map((func: (keyframeId: number) => void) => {
                    func(nextId);
                })
            }
        }
        private addPKeyframeId(id: number): number {
            return (id + 1) % this.MAP_SIZE;
        }

        /**
         * Constructor
         * @param stuckChecker enable checker to periodically check whether queue have been dequeued
         * @param sender sender to send arraybuffer to remote
         * @param receiver callback queues called when receive an interpolate packet
         */
        constructor(stuckChecker: boolean, private sender: (data: packet_command.IPoseInterpolateData) => void = message_command.setMotorInterpolate, receiver: (() => void)[] = message_command.onRcvCIInterpolateMessage) {
            receiver.push(this.onInterpolateMessage.bind(this));

            if (stuckChecker) {     // if checker used, check stuck of dequeue in a long time
                this.lastTimeWriteCount = softrobot.device.robotState.interpolateTargetCountOfWrite;
                setInterval(this.check, SendKeyframeQueue.STUCK_CHECKER_INTERVAL);
            }
        }

        // run in cycle to check wether queue is not empty but not dequeue in a long time
        public check() {
            if (this.queue.length > 0 && softrobot.device.robotState.interpolateTargetCountOfWrite == this.lastTimeWriteCount) {
                this.queryVacancy();
            } else {
                this.lastTimeWriteCount = softrobot.device.robotState.interpolateTargetCountOfWrite;
            }
        }

        /**
         * push a keyframe at the back and return
         * @param keyframe keyframe
         * @returns the id of this keyframe || -1 when queue is full
         */
        public enqueue(keyframe: IKeyframe): number {
            if (this.queue.length == SendKeyframeQueue.MAX_SIZE) return -1;

            let len = this.queue.push(keyframe);
            this.queryVacancy();
            return this.keyframeIdGenerator();
        }

        // take and return a keyframe at the front
        private dequeue(): IKeyframe {
            if (this.queue.length == 0) return undefined;
            else return this.queue.splice(0, 1)[0];
        }

        // clear all the keyframes in the queue
        public clear() {
            this.queue = [];

            this.p_keyframeId_end = this.p_keyframeId_send;
        }

        // force query interpolate state in hardware
        public forceQuery() {
            let queryObj = {
                pose: new Array(device.robotInfo.nMotor),
                period: 0,
                targetCountWrite: 0
            };
            this.sender(queryObj);
        }

        // send keyframe to remote
        private send(keyframe: IKeyframe): boolean {
            device.robotState.interpolateTargetCountOfWrite += 1;
            device.robotState.interpolateTargetCountOfWrite %= 256
            let dataObj = {
                pose: keyframe.pose,
                period: keyframe.period * 3,
                targetCountWrite: device.robotState.interpolateTargetCountOfWrite
            };

            this.writeCountMap[this.p_keyframeId_send] = dataObj.targetCountWrite;
            this.p_keyframeId_send = this.addPKeyframeId(this.p_keyframeId_send);

            this.sender(dataObj);
            return true;
        }

        // query remote for vacancy
        private queryVacancy() {
            if (this.blockQuery) {
                this.isWantQuery = true;
                return;
            }

            let queryObj = {
                pose: new Array(device.robotInfo.nMotor),
                period: 0,
                targetCountWrite: 0
            };
            this.sender(queryObj);

            this.blockQuery = true;
            setTimeout(() => {
                this.blockQuery = false;
                if (this.isWantQuery) {
                    this.queryVacancy();
                    this.isWantQuery = false;
                }
            }, SendKeyframeQueue.BLOCK_QUERY_TIME);
        }

        // get vacancy info and send interpolate message
        private onInterpolateMessage() {
            this.remoteVacancy = device.robotState.nInterpolateVacancy;
            this.updateCountRead(device.robotState.interpolateTargetCountOfReadMin);

            if (this.remoteVacancy >= device.robotState.nInterpolateTotal - SendKeyframeQueue.REMOTE_MAX_SIZE && this.queue.length > 0) {
                let keyframe: IKeyframe = this.dequeue();
                this.send(keyframe);
            }
            else if (this.queue.length > 0) {
                this.wait();
            }
        }

        // wait for a while and check vacancy again
        private wait() {
            setTimeout(() => {this.queryVacancy();}, 50);   // wait 50ms and check vacancy again
        }
    }

    export let sendKeyframeQueue: SendKeyframeQueue = new SendKeyframeQueue(false);

    /////////////////////////////// Movement Sender /////////////////////////////
    // movement tok
    // used to send all movement commands
    export class MovementSender {
        private static MAX_NOCCUPIED = 5;  // the maximum number of used space in movement list for every motor
        private static OCCUPATION_QUERY_INTERVAL_MS = 1000;           // the maximum interval for query nOccupied
        private queryTimer: number;
        private waitResponse: boolean = false;
        constructor() {
            // reset query when receive new nOccupied
            message_command.onRcvCIUMovementMessage.push(this.onRcvCIUMovementMessage.bind(this));

            // query nOccupied in fixed interval
            this.queryTimer = setTimeout(this.queryNOccupied.bind(this), MovementSender.OCCUPATION_QUERY_INTERVAL_MS);
        }
        private queryNOccupied() {
            message_command.setMovement({
                movementCommandId: command.CommandIdMovement.CI_M_QUERY
            });

            this.queryTimer = setTimeout(this.queryNOccupied.bind(this), MovementSender.OCCUPATION_QUERY_INTERVAL_MS);
        }
        private onRcvCIUMovementMessage(data: packet_command.IMovementDataRcv) {
            // reset query
            if (data.movementCommandId == command.CommandIdMovement.CI_M_ADD_KEYFRAME || command.CommandIdMovement.CI_M_QUERY) {
                this.waitResponse = false;

                clearTimeout(this.queryTimer);
                this.queryTimer = setTimeout(this.queryNOccupied.bind(this), MovementSender.OCCUPATION_QUERY_INTERVAL_MS);
            }
        }
        private canAddKeyframe(data: packet_command.IMovementData): boolean {
            if (this.waitResponse) return false;

            // check the occupation of motors
            for (let i = 0; i < data.motorCount; i++) {
                if (device.robotState.movementState.nOccupied[data.motorId[i]] >= MovementSender.MAX_NOCCUPIED) return false;
            }

            // check if paused
            if (device.robotState.movementState.isPaused(data.movementId) >= 0) return false;

            return true;
        }

        // FIXME make sure to use semaphore to access this function
        public send(data: packet_command.IMovementData): boolean {
            switch (data.movementCommandId) {
                case command.CommandIdMovement.CI_M_ADD_KEYFRAME:
                    if (!this.canAddKeyframe(data)) return false;
                    this.waitResponse = true;
                    break;
                case command.CommandIdMovement.CI_M_PAUSE_MOV:
                    device.robotState.movementState.pause(data.movementId);
                    break;
                case command.CommandIdMovement.CI_M_RESUME_MOV:
                    device.robotState.movementState.resume(data.movementId);
                    break;
                default:
                    break;
            }
            message_command.setMovement(data);
            return true;
        }
    }

    // movement name generator
    let lastMovementId: number = 0;
    export function getNewMovementName(): string {
        lastMovementId = lastMovementId + 1;
        if (lastMovementId > 255) lastMovementId = 1;
        return "default" + lastMovementId.toString();
    }

    //////////////////////////////////////////////////////////////////
    // Under this comment are data structures for animation editing block (Deprecated)

    // keyframe to specify pose to partial motors
    export interface IKeyframePartial {
        period: number;     // time to interpolate to this keyframe
        pose: number[];     // poses of motors to be interpolate
    }

    export class MovementMerger {
        static SUB_KEYFRAME_DURATION_MAX = 200; // include SUB_KEYFRAME_DURATION_MAX
        static SUB_KEYFRAME_DURATION_MIN = 50; // include SUB_KEYFRAME_DURATION_MIN
        static STANDARD_KEYFRAME_DURATION = 100;

        private queue: MovementQueue[] = [];

        addMovement(movement: MovementQueue) {
            this.queue.push(movement);
        }

        isEmpty(): boolean {
            return this.queue.length == 0;
        }

        dequeue(): IKeyframe {
            let time = this.nextShortestTime(MovementMerger.SUB_KEYFRAME_DURATION_MIN);
            if (this.nextShortestTime(MovementMerger.SUB_KEYFRAME_DURATION_MIN) > 200) {    // seperate a 100
                time = MovementMerger.STANDARD_KEYFRAME_DURATION;
            }
            let currentMotorsPose = softrobot.device.robotState.getPropArray<number>("pose", softrobot.device.robotState.motor);
            return this.addTime(time, currentMotorsPose);
        }

        clear() {
            this.queue = [];
        }

        private addTime(time: number, currentMotorsPose: number[]): IKeyframe {
            // merge pose into target
            function mergePose(target: number[], motorIds: number[], pose: number[]) {
                for (let i = 0; i < motorIds.length; i++) {
                    target[motorIds[i]] = pose[i];
                }
            }

            let targetPose = currentMotorsPose.slice();
            for (let i = 0; i < this.queue.length; i++) {
                let partialKeyframe = this.queue[i].addTime(time, currentMotorsPose);
                if (partialKeyframe.pose.length == 0) this.queue.splice(i, 1);
                else mergePose(targetPose, this.queue[i].motorIds, partialKeyframe.pose);
            }

            return {
                period: time,
                pose: targetPose
            }
        }

        // get the shortest time which is larger than limit
        private nextShortestTime(limit: number): number {
            let res: number = Number.MAX_SAFE_INTEGER;

            for (let i = 0; i < this.queue.length; i++) {
                let time = this.queue[i].getNextKeyframeTime();
                if (time < res && time >= limit) res = time;
            }

            return res;
        }
    }

    let movementMerger: MovementMerger = new MovementMerger();

    export class MovementQueue {
        public motorIds: number[];
        private queue: IKeyframePartial[];

        private time: number = 0;

        constructor(keyframes: IKeyframePartial[], motorIds: number[]) {
            this.queue = keyframes;
            this.motorIds = motorIds;
        }

        getLength() {
            return this.queue.length;
        }

        // get remaining time to next keyframe
        getNextKeyframeTime(): number {
            return this.queue[0].period - this.time;
        }

        /**
         * add time to the current movement
         * @param time time to be add to the current time
         * @param currentMotorsPose the current motor pose
         * @returns 
                    {
                        period: time diff between this current time and prev neighbor keyframe time
                        pose: pose at current time 
                    }
                    Note: if time is larger than the last period, return {period: ..., pose: []}
         */
        addTime(time: number, currentMotorsPose: number[]): IKeyframePartial {
            let newTime = this.time + time;
            let pose = [];
            if (newTime < this.queue[0].period) {   // interpolate between current state and first keyframe
                // get interpolated pose
                for (let i = 0; i < this.motorIds.length && i < currentMotorsPose.length; i++) {
                    let motorId = this.motorIds[i];
                    let keyframe = this.queue[0];
                    pose.push(util.interpolate(0, currentMotorsPose[motorId], keyframe.period - this.time, keyframe.pose[i], time));
                }
            }
            else {                                  // interpolate between two keyframes
                // get interpolated pose
                let preKeyId = 0;
                newTime -= this.queue[preKeyId].period;
                while (preKeyId + 1 < this.queue.length && newTime < this.queue[preKeyId + 1].period) {
                    newTime -= this.queue[preKeyId].period;
                    preKeyId++;
                }

                if (newTime == 0) {                             // the time is on a keyframe
                    pose = this.queue[preKeyId].pose;
                }
                else if (preKeyId + 1 < this.queue.length) {    // the time is between two keyframes
                    for (let i = 0; i < this.motorIds.length; i++) {
                        let preKeyframe = this.queue[preKeyId], nextKeyframe = this.queue[preKeyId + 1];
                        pose.push(util.interpolate(0, preKeyframe.pose[i], nextKeyframe.period, nextKeyframe.pose[i], newTime));
                    }
                }
                else {                                          // the time is larger than last keyframe period
                }

                // dequeue keyframes
                this.queue.splice(0, preKeyId + 1);
            }

            this.time = newTime;

            return {
                period: newTime,
                pose: pose
            }
        }
    }
}