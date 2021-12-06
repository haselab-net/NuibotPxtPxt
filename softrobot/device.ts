/**
 * Store the information of softrobot
 */

namespace softrobot.device {
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
        nvsSettings: {[key: string]: NvsSetting}

        constructor() {
            this.initialize();
        }

        /**
         * initialize parameters with default value
         */
        initialize() {
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
        }

        initializeNvsSettings() {
            this.nvsSettings = {
                auto_start: {
                    type: util.cDataType.uint8,
                    value: false,
                    description: "Start JS when robot is switch on",
                    // validator: () => true
                },
                heatLimit0: {                           // TODO check wether heat limit num would change
                    type: util.cDataType.uint32,
                    value: 0,
                    description: "",
                },
                heatRelease0: {
                    type: util.cDataType.uint32,
                    value: 0,
                    description: "",
                },
                heatLimit1: {
                    type: util.cDataType.uint32,
                    value: 0,
                    description: "",
                },
                heatRelease1: {
                    type: util.cDataType.uint32,
                    value: 0,
                    description: "",
                },
                heatLimit2: {
                    type: util.cDataType.uint32,
                    value: 0,
                    description: "",
                },
                heatRelease2: {
                    type: util.cDataType.uint32,
                    value: 0,
                    description: "",
                },
            }
        }
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
            this.initialize();
        }

        /**
         * initialize parameters with default value
         */
        initialize() {
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
    }

    /**
     * state of movement manager
     */
    export class MovementState {
        nOccupied: number[];        // count of keyframes in movement linked list
        pausedMovements: number[];   // paused movementId

        constructor() {
            this.initialize();
        }

        initialize() {
            this.nOccupied = new Array<number>(robotInfo.nMotor);
            for (let index = 0; index < this.nOccupied.length; index++) {
                this.nOccupied[index] = 0;
            }
            this.pausedMovements = [];
        }

        // return index of paused movement, return -1 if not found
        isPaused(movementId: number): number {
            for (let i = 0; i < this.pausedMovements.length; i++) {
                if (this.pausedMovements[i] == movementId) return i;
            }
            return -1;
        }

        pause(movementId: number) {
            if (this.isPaused(movementId) < 0) this.pausedMovements.push(movementId);
        }

        resume(movementId: number) {
            let id = this.isPaused(movementId);
            if (id >= 0) this.pausedMovements.splice(id, 1);
        }
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

        constructor() {
            this.initialize();
        }

        /**
         * initialize parameters with default value
         */
        initialize() {
            this.motor = new Array<MotorState>(robotInfo.nMotor);
            for (let index = 0; index < this.motor.length; index++) {
                this.motor[index] = new MotorState();
            }
            this.current = new Array<number>(robotInfo.nCurrent);
            for (let index = 0; index < this.current.length; index++) {
                this.current[index] = 0;
            }
            this.force = new Array<number>(robotInfo.nForces);
            for (let index = 0; index < this.force.length; index++) {
                this.force[index] = 0;
            }
            this.touch = new Array<number>(robotInfo.nTouch);
            for (let index = 0; index < this.touch.length; index++) {
                this.touch[index] = 0;
            }

            this.nInterpolateTotal = 12;
            this.interpolateTargetCountOfWrite = -1;
            this.interpolateTargetCountOfReadMin = 0;
            this.interpolateTargetCountOfReadMax = 0;
            this.interpolateTickMin = 0;
            this.interpolateTickMax = 0;
            this.nInterpolateRemain = 0;
            this.nInterpolateVacancy = 12;

            this.movementState = new MovementState();
        }

        /**
         * combine props of an object array to an prop array
         * @description assume object have property p, this function convert object[] into p[]
         * @param name one property (type T) name of object
         * @param array array of object
         */
        getPropArray<T>(name: string, array: Array<any>): Array<T> {
            if (!(name in array[0])) {
                console.log("ERROR: No property named " + name + "in array");
                return null;
            }

            let res: Array<T> = new Array<T>();
            for (let i: number = 0; i < array.length; i++) {
                res.push(array[i][name] as T);
            }
            return res;
        }
        /**
         * set props of an object array to an prop array
         * @param name name of the property
         * @param pArray property value array
         * @param oArray object array
         */
        setPropArray<T>(name: string, pArray: Array<T>, oArray: Array<any>){
            if (pArray.length != oArray.length) {
                console.log("Error: Not equivalent length array");
                return;
            }
            if (!(name in oArray[0])) {
                console.log("ERROR: No property named " + name + "in array");
                return;
            }

            let res = oArray;
            for (let index = 0; index < res.length; index++) {
                res[index][name] = pArray[index];
            }
        }
    }
    export let robotState: RobotState = new RobotState();

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

            return array;
        }
        function resizeMotorStateArray(array: Array<MotorState>, size: number): Array<MotorState> {
            if (array.length <= size) {
                let formalLength = size - array.length;
                for (let i = 0; i < formalLength; i++) {
                    let newVal = new MotorState();
                    array.push(newVal);
                }
            }
            else array = array.slice(0, size);

            console.log(array);

            return array;
        }
        function changeRobotState(state: RobotState, info: RobotInfo) {
            state.nInterpolateTotal = info.nTarget;

            if (state.motor.length != info.nMotor) state.motor = resizeMotorStateArray(state.motor, info.nMotor);
            if (state.current.length != info.nCurrent) state.current = resizeArray(state.current, info.nCurrent);
            if (state.force.length != info.nForces) state.force = resizeArray(state.force, info.nForces);
            if (state.touch.length != info.nTouch) state.touch = resizeArray(state.touch, info.nTouch);
            if (state.movementState.nOccupied.length != info.nMotor) state.movementState.nOccupied = resizeArray(state.movementState.nOccupied, info.nMotor);
        }

        console.log(robotState);
        changeRobotState(robotState, robotInfo);
        console.log(robotState);
    }
}