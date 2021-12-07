/**
 * Store the information of softrobot
 */

namespace softrobot.device {
    export enum ParameterKey {
        nuibotIp = "NuibotIP",
        nuibotId = "NuibotID"
    }

    /////////////////////////////////////////////////////////////////
    /////////////////////////    State    ///////////////////////////
    /////////////////////////////////////////////////////////////////

    export interface FirmwareInfo {
        version: string;
    }

    export interface NvsSetting {
        type: softrobot.util.cDataType;             // value type that stores in NVS
        value: boolean | number | string;           // value of parameter
        description: string;                        // description of the NVS parameter
        label: string;                              // display name
        // validator: (value: boolean | number | string) => boolean;   // validate the input
    }

    /**
     * information of robot hardware
     * @description (can not be changed on web side)
     */
    export class RobotInfo {
        systemId: number;
        nTarget: number;
        nMotor: number;                                 // number of motors
        nCurrent: number;                               // number of current sensor
        nForces: number;                                // number of force sensor
        nTouch: number;                                 // number of touch sensor
        macAddress: ArrayBuffer;                        // mac address

        firmwareInfo: FirmwareInfo;
        nvsSettings: {[key: string]: NvsSetting};

        MS_PER_MOVEMENT_TICK: number;                   // NOTE not used

        constructor() {
            this.initializeNvsSettings = function () {
                this.nvsSettings = {
                    auto_start: {
                        type: util.cDataType.uint8,
                        value: false,
                        description: "Start JS when robot is switch on",
                        label: lf("Auto start"),
                        // validator: () => true
                    },
                    heatLimit0: {                           // TODO check wether heat limit num would change
                        type: util.cDataType.int32,
                        value: 0,
                        description: "",
                        label: lf("Heat limit 0"),
                    },
                    heatRelease0: {
                        type: util.cDataType.int32,
                        value: 0,
                        description: "",
                        label: lf("Heat release 0"),
                    },
                    heatLimit1: {
                        type: util.cDataType.int32,
                        value: 0,
                        description: "",
                        label: lf("Heat limit 1"),
                    },
                    heatRelease1: {
                        type: util.cDataType.int32,
                        value: 0,
                        description: "",
                        label: lf("Heat release 1"),
                    },
                    heatLimit2: {
                        type: util.cDataType.int32,
                        value: 0,
                        description: "",
                        label: lf("Heat limit 2"),
                    },
                    heatRelease2: {
                        type: util.cDataType.int32,
                        value: 0,
                        description: "",
                        label: lf("Heat release 2"),
                    },
                }
            }
            this.initialize = function () {
                this.systemId = 0;
                this.nTarget = 12;
                this.nMotor = 3;
                this.nCurrent = 0;
                this.nForces = 0;
                this.nTouch = 1;
                this.macAddress = new ArrayBuffer(6);

                this.firmwareInfo = {
                    version: "unknown"
                };

                this.initializeNvsSettings();

                this.MS_PER_MOVEMENT_TICK = 50;
            }

            this.initialize();
        }

        private initialize: () => void
        private initializeNvsSettings: () => void
    }
    export let robotInfo: RobotInfo = new RobotInfo();

    /**
     * state/parameter of a single motor
     */
    export class MotorState {
        [key: string]: any;
        pose: number;
        velocity: number;
        lengthMin: number;
        lengthMax: number;
        controlK: number;
        controlB: number;
        controlA: number;
        torqueMin: number;
        torqueMax: number;

        poseRcv: number;        // pose data from softrobot
        velocityRcv: number;    // velocity data from softrobot

        constructor() {
            this.initialize = function () {
                this.pose = 0;
                this.velocity = 0;
                this.lengthMin = -5000;
                this.lengthMax = 5000;
                this.controlK = 4096;
                this.controlB = 2048;
                this.controlA = 0;
                this.torqueMin = -1024;
                this.torqueMax = 1024;

                this.poseRcv = 0;
                this.velocityRcv = 0;
            }
            this.initialize();
        }

        /**
         * initialize parameters with default value
         */
        private initialize: () => void
    }

    export interface Keyframe {
        movementId: number;
        keyframeId: number;
        startTime: number;
        endTime: number;
    }

    /**
     * state of movement manager
     */
    export class MovementState {
        nOccupied: number[];        // count of keyframes in movement linked list
        pausedMovements: number[];   // paused movementId

        movementManagerMovementIds: number[];   // ids of movements inside movement manager
        movementManagerKeyframeCount: number[];   // count of keyframes remaining in movement manager for every movement
        movementKeyframes: {[key: number]: Keyframe[]};    // keyframes for every movement

        movementTime: number; // time (ms)

        constructor() {
            this.initialize = function () {
                this.nOccupied = new Array<number>(robotInfo.nMotor);
                for (let index = 0; index < this.nOccupied.length; index++) {
                    this.nOccupied[index] = 0;
                }
                this.pausedMovements = [];

                this.movementManagerMovementIds = [];
                this.movementManagerKeyframeCount = [];
                this.movementKeyframes = {};

                this.movementTime = 0;
            }
            this.isPaused = function (movementId: number): number {
                for (let i = 0; i < this.pausedMovements.length; i++) {
                    if (this.pausedMovements[i] == movementId) return i;
                }
                return -1;
            }
            this.isInQueue = function(movementId: number): number {
                for (let i = 0; i < this.movementManagerMovementIds.length; i++) {
                    if (this.movementManagerMovementIds[i] == movementId) return i;
                }
                return -1;
            }
            this.pause = function(movementId: number) {
                if (this.isPaused(movementId) < 0) this.pausedMovements.push(movementId);
            }
            this.resume = function(movementId: number) {
                let id = this.isPaused(movementId);
                if (id >= 0) this.pausedMovements.splice(id, 1);
            }
            this.clearPaused = function() {
                this.pausedMovements = [];
            }
            this.addKeyframe = function(keyframe: Keyframe) {
                const id = keyframe.movementId;
                if (!this.movementKeyframes[id]) this.movementKeyframes[id] = [];

                let i = this.movementKeyframes[id].length - 1;
                while (i >= 0 && util.aLessThanB(keyframe.startTime, this.movementKeyframes[id][i].startTime, 1 << 16)) {
                    i--;
                }
                this.movementKeyframes[id].splice(i + 1, 0, keyframe);
            }
            this.proceedTime = function(movementTime: number) {
                this.movementTime = movementTime;

                for (const movementId in this.movementKeyframes) {
                    const keyframes = this.movementKeyframes[movementId];
                    if (!keyframes) continue;

                    let i = 0;
                    while (i < keyframes.length && util.aLessThanB(keyframes[i].endTime, movementTime, 1 << 16)) i++;
                    this.movementKeyframes[movementId].splice(0, i);
                    if (keyframes.length == 0) this.movementKeyframes[movementId] = undefined
                }
            }
            this.getRemainingMovementCount = function(movementId: number) {
                const keyframes = this.movementKeyframes[movementId]
                if (!keyframes || keyframes.length === 0) return 0

                let count = 1;
                for (let i = 0; i < keyframes.length - 1; i++) {
                    if (keyframes[i + 1].keyframeId <= keyframes[i].keyframeId) {
                        count++
                    }
                }
                return count
            }
            this.getRemainingMovementKeyframeCount = function(movementId: number) {
                const keyframes = this.movementKeyframes[movementId]
                if (!keyframes) return 0
                return keyframes.length
            }

            this.initialize();
        }

        private initialize: () => void;

        // return index of paused movement, return -1 if not found
        isPaused: (movementId: number) => number;
        // return index of queue movement, return -1 if not found
        isInQueue: (movementId: number) => number;

        pause: (movementId: number) => void
        resume: (movementId: number) => void
        clearPaused: () => void

        addKeyframe: (keyframe: Keyframe) => void
        proceedTime: (movementTime: number) => void
        getRemainingMovementCount: (movementId: number) => number
        getRemainingMovementKeyframeCount: (movementId: number) => number
    }

    /**
     * state/parameter of robot
     */
    export class RobotState {
        motor: MotorState[];
        current: number[];                              // current sensor's values
        force: number[];                                // force sensor's values
        touch: number[];

        nInterpolateTotal: number;                      // capacity of interpolation targets
        interpolateTargetCountOfWrite: number;          // count of interpolation at write cursor
        interpolateTargetCountOfReadMin: number;        // count of interpolation at read cursor
        interpolateTargetCountOfReadMax: number;        // count of interpolation at read cursor
        interpolateTickMin: number;                     // tick of interpolation
        interpolateTickMax: number;                     // tick of interpolation
        nInterpolateRemain: number;                     // number of data in target buffer
        nInterpolateVacancy: number;                    // target buffer vacancy

        movementState: MovementState;

        /**
        * initialize parameters with default value
        */
        initialize: () => void

        constructor() {
            this.initialize = function() {
                this.motor = new Array<MotorState>(robotInfo.nMotor);
                for (let index = 0; index < this.motor.length; index++) {
                    this.motor[index] = util.instance2PlainShallow(new MotorState()) as MotorState;
                }
                this.current = new Array<number>(robotInfo.nCurrent);
                for (let index = 0; index < this.current.length; index++) {
                    this.current[index] = 0;
                }
                this.force = new Array<number>(robotInfo.nForces);
                for (let index = 0; index < this.force.length; index++) {
                    this.force[index] = 0;
                }
                this.touch = [];

                this.nInterpolateTotal = 12;
                this.interpolateTargetCountOfWrite = -1;
                this.interpolateTargetCountOfReadMin = 0;
                this.interpolateTargetCountOfReadMax = 0;
                this.interpolateTickMin = 0;
                this.interpolateTickMax = 0;
                this.nInterpolateRemain = 0;
                this.nInterpolateVacancy = 12;

                this.movementState = util.instance2PlainShallow(new MovementState()) as MovementState;
            }
            this.initialize();
        }
    }
    export let robotState: RobotState = new RobotState()

    /**
     * check the length of pose/velocity/current/force array in robot state is the same as corresponding value in robot info
     * @description if current array length is less than target length, the insufficient part of array will be initialized with array[0]
     */
    export function checkRobotState() {
        function resizeArray(array: Array<number>, size: number): Array<number> {
            if (array.length <= size) {
                let formalLength = size - array.length;
                for (let i = 0; i < formalLength; i++) {
                    let newVal;
                    if (array.length == 0) newVal = 0;
                    else newVal = array[0];
                    array.push(newVal)
                }
            }
            else array = array.slice(0, size);

            return [...array];
        }
        function resizeMotorStateArray(array: Array<MotorState>, size: number): Array<MotorState> {
            if (array.length <= size) {
                let formalLength = size - array.length;
                for (let i = 0; i < formalLength; i++) {
                    let newVal = util.instance2PlainShallow(new MotorState()) as MotorState;
                    array.push(newVal);
                }
            }
            else array = array.slice(0, size);

            return [...array];
        }
        function changeRobotState(state: RobotState, info: RobotInfo) {
            state.nInterpolateTotal = info.nTarget;

            if (state.motor.length != info.nMotor) state.motor = resizeMotorStateArray(state.motor, info.nMotor);
            if (state.current.length != info.nCurrent) state.current = resizeArray(state.current, info.nCurrent);
            if (state.force.length != info.nForces) state.force = resizeArray(state.force, info.nForces);
            // if (state.touch.length != info.nTouch) state.touch = resizeArray(state.touch, info.nTouch);
            if (state.movementState.nOccupied.length != info.nMotor) state.movementState.nOccupied = resizeArray(state.movementState.nOccupied, info.nMotor);
        }

        changeRobotState(robotState, robotInfo);
    }
}
