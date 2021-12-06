/**
 * Provide API for send/receive command message to/from softrobot
 * @author gzl
 */

namespace softrobot.message_command {
    /////////////////////////////////////////////////////////////////
    /////////////////////////    Callbacks //////////////////////////
    /////////////////////////////////////////////////////////////////

    export function onReceiveCIBoardinfo(data: Partial<device.RobotInfo>) {
        util.copyProps(device.robotInfo, data)
        device.checkRobotState();

        // save nuibotId to local storage
        localStorage.setItem(device.ParameterKey.nuibotId, util.macAddress2NuibotId(data.macAddress))

        for (let i: number = 0; i < onRcvCIBoardInfoMessage.length; i++) {
            onRcvCIBoardInfoMessage[i]();
        }
    }
    export function onReceiveCISensor(data: packet_command.ISensorDataRcv) {
        callbacks.onRcvTouchMessage(device.robotState.touch, data.touch);

        util.setPropArray("poseRcv", data.pose, device.robotState.motor);
        device.robotState.current = data.current;
        device.robotState.force = data.force;
        device.robotState.touch = data.touch;

        for (let i: number = 0; i < onRcvCISensorMessage.length; i++) {
            onRcvCISensorMessage[i]();
        }
    }
    export function onReceiveCIDirect(data: packet_command.IPoseDirectDataRcv) {
        util.setPropArray("poseRcv", data.pose, device.robotState.motor);
        util.setPropArray("velocityRcv", data.velocity, device.robotState.motor);
    }
    export function onReceiveCIInterpolate(data: packet_command.IPoseInterpolateDataRcv) {
        function calculateInterpolateState() {
            let rmin = device.robotState.interpolateTargetCountOfReadMin;
            let rmax = device.robotState.interpolateTargetCountOfReadMax;
            let tmin = device.robotState.interpolateTickMin;
            let tmax = device.robotState.interpolateTickMax;

            let wc = device.robotState.interpolateTargetCountOfWrite;
            device.robotState.nInterpolateRemain = wc >= rmax ? wc - rmax + 1 : wc - rmax + 1 + 256;
            let readDiff = rmax >= rmin ? rmax - rmin : rmax - rmin + 256;
            device.robotState.nInterpolateVacancy = device.robotState.nInterpolateTotal - device.robotState.nInterpolateRemain - readDiff;
        }

        util.setPropArray("poseRcv", data.pose, device.robotState.motor);

        device.robotState.interpolateTargetCountOfReadMin = data.targetCountReadMin;
        device.robotState.interpolateTargetCountOfReadMax = data.targetCountReadMax;
        device.robotState.interpolateTickMin = data.tickMin;
        device.robotState.interpolateTickMax = data.tickMax;

        calculateInterpolateState();
        if (device.robotState.nInterpolateVacancy > device.robotState.nInterpolateTotal - 2 || device.robotState.nInterpolateVacancy < 0) {  // if [count read] is reset, reset [count write]
            device.robotState.interpolateTargetCountOfWrite = (device.robotState.interpolateTargetCountOfReadMax + 1) % 256;
            calculateInterpolateState();
        }

        for (let i: number = 0; i < onRcvCIInterpolateMessage.length; i++) {
            onRcvCIInterpolateMessage[i]();
        }
    }
    export function onReceiveCISetparam() {
        return;
    }
    export function onReceiveCIResetsensor() {
        for (let i: number = 0; i < onRcvCIResetSensorMessage.length; i++) {
            onRcvCIResetSensorMessage[i]();
        }
    }
    export function onReceiveCIUMovement(data: packet_command.IMovementDataRcv) {
        switch (data.movementCommandId) {
            case command.CommandIdMovement.CI_M_ADD_KEYFRAME:
                device.robotState.movementState.addKeyframe({
                    movementId: data.movementId,
                    keyframeId: data.keyframeId,
                    startTime: data.startTime,
                    endTime: data.endTime
                })
            case command.CommandIdMovement.CI_M_QUERY:
                device.robotState.movementState.proceedTime(data.movementTime)

                device.robotState.movementState.nOccupied = data.nOccupied;
                device.robotState.movementState.movementManagerMovementIds = data.movementManagerMovementIds;
                device.robotState.movementState.movementManagerKeyframeCount = data.movementManagerKeyframeCount;
                break;
            default:
                break;
        }

        onRcvCIUMovementMessage.map((val) => val(data));
    }

    export let onRcvCIBoardInfoMessage: (() => void)[] = [];        // overwrite by target
    export let onRcvCISensorMessage: (() => void)[] = [];           // overwrite by target
    export let onRcvCIDirectMessage: (() => void)[] = [];           // overwrite by target
    export let onRcvCIInterpolateMessage: (() => void)[] = [];      // overwrite by target
    export let onRcvCIResetSensorMessage: (() => void)[] = [];      // overwrite by target
    export let onRcvCIUMovementMessage: util.MyMap<(data: packet_command.IMovementDataRcv) => void> = new util.MyMap<(data: packet_command.IMovementData) => void>();

    /////////////////////////////////////////////////////////////////
    /////////////////////////    Receive    /////////////////////////
    /////////////////////////////////////////////////////////////////
    export function messageHandler(packet: packet_command.Packet) {
        switch (packet.command as command.CommandId) {
            case command.CommandId.CI_BOARD_INFO:
            {
                onReceiveCIBoardinfo(packet.data.data);
                break;
            }
            case command.CommandId.CI_SENSOR:
            {
                onReceiveCISensor(packet.data.data);
                break;
            }
            case command.CommandId.CI_DIRECT:
            {
                onReceiveCIDirect(packet.data.data);
                break;
            }
            case command.CommandId.CI_INTERPOLATE:
            {
                onReceiveCIInterpolate(packet.data.data);
                break;
            }
            case command.CommandId.CI_FORCE_CONTROL:
            {
                // TODO replace later
                let data: packet_command.IPoseForceControlDataRcv = packet.data.data as packet_command.IPoseForceControlDataRcv;

                util.setPropArray("pose", data.pose, device.robotState.motor);

                device.robotState.interpolateTargetCountOfReadMin = data.targetCountReadMin;
                device.robotState.interpolateTargetCountOfReadMax = data.targetCountReadMax;
                device.robotState.interpolateTickMin = data.tickMin;
                device.robotState.interpolateTickMax = data.tickMax;

                device.robotState.nInterpolateRemain = device.robotState.interpolateTargetCountOfReadMax - device.robotState.interpolateTargetCountOfReadMin + 1;
                device.robotState.nInterpolateVacancy = device.robotState.nInterpolateTotal - device.robotState.nInterpolateRemain;

                if (device.robotState.interpolateTargetCountOfWrite < device.robotState.interpolateTargetCountOfReadMax) device.robotState.interpolateTargetCountOfWrite = device.robotState.interpolateTargetCountOfReadMax

                break;
            }
            case command.CommandId.CI_SET_PARAM:
            {
                break;
            }
            case command.CommandId.CI_RESET_SENSOR:
            {
                onReceiveCIResetsensor();
                break;
            }
            case command.CommandId.CIU_MOVEMENT:
            {
                onReceiveCIUMovement(packet.data.data as packet_command.IMovementDataRcv);
                break;
            }
            default:
            {
                console.log("softrobot.message::messageHandler: unrecognized command - " + packet.command);
                break;
            }
        }
    }

    /////////////////////////////////////////////////////////////////
    /////////////////////////    Send    ////////////////////////////
    /////////////////////////////////////////////////////////////////
    export let sendArrayBuffer = function (buffer: ArrayBuffer) {   // overwite by socket.ts
        console.log("empty function: sendArrayBuffer");
    };

    export function sendMessage(packet: packet_command.Packet) {
        let bin: ArrayBuffer = packet.toBinary();
        if (!bin) {
            console.log("sofrobot.message_command::sendMessage: can not convert Packet to Arraybuffer");
            return;
        }

        sendArrayBuffer(bin);
    };

    /**
     * change motor state/parameter
     */
    export interface IMotorInstruction {
        [key: string]: number;
        motorId: number;
        pose?: number;
        velocity?: number;
        lengthMin?: number;
        lengthMax?: number;
        controlK?: number;
        controlB?: number;
        controlA?: number;
        torqueMin?: number;
        torqueMax?: number;
    }

    /**
     * update motor state 'to' with instruction in 'from'
     * @param to robot state in which motor state will be altered later
     * @param from motor instruction which to be used to change motor state
     */
    export function setMotorState(to: device.RobotState, from: IMotorInstruction) {
        let id = from.motorId;
        if (id >= to.motor.length) return;

        if (util.haveProp(from.pose)) to.motor[id].pose = util.limitNum(from.pose, to.motor[id].lengthMin, to.motor[id].lengthMax);
        if (util.haveProp(from.velocity)) to.motor[id].velocity = from.velocity;
        if (util.haveProp(from.lengthMin)) to.motor[id].lengthMin = from.lengthMin;
        if (util.haveProp(from.lengthMax)) to.motor[id].lengthMax = from.lengthMax;
        if (util.haveProp(from.controlK)) to.motor[id].controlK = from.controlK;
        if (util.haveProp(from.controlB)) to.motor[id].controlB = from.controlB;
        if (util.haveProp(from.controlA)) to.motor[id].controlA = from.controlA;
        if (util.haveProp(from.torqueMin)) to.motor[id].torqueMin = from.torqueMin;
        if (util.haveProp(from.torqueMax)) to.motor[id].torqueMax = from.torqueMax;

        to.motor[id].pose = util.limitNum(to.motor[id].pose, to.motor[id].lengthMin, to.motor[id].lengthMax);
    }

    /////////////////////////////////////////////////////////////////
    /////////////////////////    Basic Send Functions    ////////////
    /////////////////////////////////////////////////////////////////

    /**
     * update remote motor pose and velocity (direct mode) by local robot state
     */
    export function setMotorDirect(data: packet_command.IPoseDirectData,
                                        pktSender: (packet: packet_command.Packet) => void = sendMessage,
                                        queue: movement.SendKeyframeQueue = movement.sendKeyframeQueue) {

        queue.clear();          // clear waiting keyframes

        // reinit interpolate parameters
        softrobot.device.robotState.interpolateTargetCountOfWrite = -1;
        softrobot.device.robotState.nInterpolateVacancy = softrobot.device.robotState.nInterpolateTotal;
        softrobot.device.robotState.nInterpolateRemain = 0;

        let p: packet_command.Packet = new packet_command.Packet(command.CommandId.CI_DIRECT, new packet_command.PacketPoseDirectData(data));
        if (!p) return;
        pktSender(p);
    }

    /**
     * update remote motor pose and velocity (interpolate mode) by local robot state
     * @param period period to interpolate
     */
    export function setMotorInterpolate(data: packet_command.IPoseInterpolateData,
                                                pktSender: (packet: packet_command.Packet) => void = sendMessage,
                                                queue: movement.SendKeyframeQueue = movement.sendKeyframeQueue) {
        let p: packet_command.Packet = new packet_command.Packet(command.CommandId.CI_INTERPOLATE, new packet_command.PacketPoseInterpolateData(data));
        if (!p) return;
        pktSender(p);
    }

    export function setMotorParam(data: packet_command.IParamData,
                                    pktSender: (packet: packet_command.Packet) => void = sendMessage) {
        let p: packet_command.Packet = new packet_command.Packet(command.CommandId.CI_SET_PARAM, new packet_command.PacketParamData(data));
        if (!p) return;
        pktSender(p);
    }

    /**
     * require for board info
     */
    export function requireBoardInfo() {
        let p: packet_command.Packet = new packet_command.Packet(command.CommandId.CI_BOARD_INFO, new packet_command.PacketBoardInfoData({}));
        sendMessage(p);
    }

    /**
     * require for sensor info
     */
    export function requireSensorInfo() {
        let p: packet_command.Packet = new packet_command.Packet(command.CommandId.CI_SENSOR, new packet_command.PacketSensorInfoData({}));
        sendMessage(p);
    }

    /**
     * reset sensor
     * @param flag type of sensor to reset
     */
    export function resetSensor(data: packet_command.IResetSensorData) {
        sendMessage(new packet_command.Packet(command.CommandId.CI_RESET_SENSOR, new packet_command.PacketResetSensorData(data)));
    }

    /**
     * set movement (add movement, pause, resume ...)
     * @param data content of command = movementCommandId + data
     */
    export function setMovement(data: packet_command.IMovementData) {
        sendMessage(new packet_command.Packet(command.CommandId.CIU_MOVEMENT, new packet_command.PacketMovementData(data)));
    }


    /////////////////////////////////////////////////////////////////
    /////////////////////////    Control    /////////////////////////
    /////////////////////////////////////////////////////////////////
    /**
     * set local motor state and update it to remote hardware
     * @param inst motor instruction
     */
    export function updateRemoteMotorState(inst: IMotorInstruction) {
        if (inst.motorId >= device.robotInfo.nMotor) {
            console.log("motorId larger than motor number");
            return;
        }

        if (util.haveProp(inst.pose) || util.haveProp(inst.velocity)) {
            if (util.haveProp(inst.pose)) device.robotState.motor[inst.motorId].pose = util.limitNum(inst.pose, device.robotState.motor[inst.motorId].lengthMin, device.robotState.motor[inst.motorId].lengthMax);
            if (util.haveProp(inst.velocity)) device.robotState.motor[inst.motorId].velocity = inst.velocity;
            let pose: number[] = util.getPropArray<number>("pose", device.robotState.motor);
            let velocity: number[] = util.getPropArray<number>("velocity", device.robotState.motor);
            movement.sendKeyframeQueue.clear();      // clear waiting keyframes in the queue
            setMotorDirect({
                pose: pose,
                velocity: velocity
            });
        }
        if (util.haveProp(inst.lengthMin) || util.haveProp(inst.lengthMax)) {
            if (util.haveProp(inst.lengthMin)) device.robotState.motor[inst.motorId].lengthMin = inst.lengthMin;
            if (util.haveProp(inst.lengthMax)) device.robotState.motor[inst.motorId].lengthMax = inst.lengthMax;
        }
        if (util.haveProp(inst.controlK) || util.haveProp(inst.controlB)) {
            if (util.haveProp(inst.controlK)) device.robotState.motor[inst.motorId].controlK = inst.controlK;
            if (util.haveProp(inst.controlB)) device.robotState.motor[inst.motorId].controlB = inst.controlB;
            let controlK: number[] = util.getPropArray<number>("controlK", device.robotState.motor);
            let controlB: number[] = util.getPropArray<number>("controlB", device.robotState.motor);
            setMotorParam({
                paramType: command.SetParamType.PT_PD,
                params1: controlK,
                params2: controlB});
        }
        if (util.haveProp(inst.controlA)) {
            if (util.haveProp(inst.controlA)) device.robotState.motor[inst.motorId].controlA = inst.controlA;
            let controlA: number[] = util.getPropArray<number>("controlA", device.robotState.motor);
            setMotorParam({
                paramType: command.SetParamType.PT_CURRENT,
                params1: controlA,
                params2: undefined});
        }
        if (util.haveProp(inst.torqueMin) || util.haveProp(inst.torqueMax)) {
            if (util.haveProp(inst.torqueMin)) device.robotState.motor[inst.motorId].torqueMin = inst.torqueMin;
            if (util.haveProp(inst.torqueMax)) device.robotState.motor[inst.motorId].torqueMax = inst.torqueMax;
            let torqueMin: number[] = util.getPropArray<number>("torqueMin", device.robotState.motor);
            let torqueMax: number[] = util.getPropArray<number>("torqueMax", device.robotState.motor);
            setMotorParam({
                paramType: command.SetParamType.PT_TORQUE_LIMIT,
                params1: torqueMin,
                params2: torqueMax});
        }
    }

    /**
     * only set local motor state
     * @param inst motor instruction
     */
    export function updateLocalMotorState(inst: IMotorInstruction) {
        if (inst.motorId >= device.robotInfo.nMotor) {
            console.log("motorId larger than motor number");
            return;
        }

        setMotorState(device.robotState, inst);
    }

    export function updateRemoteDirect() {
        movement.sendKeyframeQueue.clear();
        setMotorDirect({
            pose: util.getPropArray<number>("pose", device.robotState.motor),
            velocity: util.getPropArray<number>("velocity", device.robotState.motor)
        });
    }
}
