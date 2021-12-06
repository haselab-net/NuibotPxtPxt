namespace softrobot.command {
    export enum CommandId {
        CI_NONE = 0,				//0	As reset makes 0 and 0xFF, must avoid use of them in header.
        CI_BOARD_INFO = 1,          //1 Board information.
        CI_SET_CMDLEN = 2,			//2	Set command length for each board id.
        CI_ALL = 3,					//3 Send all data and return all status
        CI_SENSOR = 4,				//4	Return sensor data
        CI_DIRECT = 5,              //5 Directly set servo targets (positions and velicities).
        CI_CURRENT = 6,             //6 Set currents as servo targets.
        CI_INTERPOLATE = 7,         //7 Send new frame for interpolation.
        CI_FORCE_CONTROL = 8,		//8	Position and force control with interpolation.
        CI_SET_PARAM = 9,            //9 Set parameter.
        CI_RESET_SENSOR = 10,       //10 Reset sensor.
        CI_GET_PARAM = 11,            //11 Get parameter.
        CI_NCOMMAND = 12,
        CI_NCOMMAND_MAX = 32,     //0 to 31 can be used for UART command, because command ID has 5 bits.
        CIU_TEXT = CI_NCOMMAND_MAX,
                                //32 return text message: cmd, type, length, bytes
        CIU_SET_IPADDRESS = 33,		//33 Set ip address to return the packet
        CIU_GET_IPADDRESS = 34,      //34 Get ip address to return the packet
        CIU_GET_SUBBOARD_INFO = 35,  //35 Get sub board info
        CIU_MOVEMENT = 36,			//36 movement command
        CIU_NCOMMAND = 37,           //37 number of commands
        CIU_NONE = -1           //  no command is in receiving state.
    };

    export enum SetParamType {
        PT_PD = 0,
        PT_CURRENT = 1,
        PT_TORQUE_LIMIT = 2,
        PT_BOARD_ID = 3,
    };

    export enum ResetSensorFlags {
        RSF_NONE = 0,
        RSF_MOTOR = 1,
        RSF_FORCE = 2
    }

    export enum PacketId {
        PI_NONE = 0,
        PI_JSFILE = 1,      // send JS file
        PI_COMMAND = 2,     // control
        PI_SETTINGS = 3,    // change control mode
        PI_PINGPONG = 4,    // keep alive
        PI_OTA = 5          // start OTA
    }

    export enum PacketSettingsId {
        PSI_NONE = 0,
        PSI_OFFLINE_MODE = 1,
        PSI_FIRMWARE_INFO = 2,
        PSI_WRITE_NVS = 3,
        PSI_READ_NVS = 4
    };

    export enum CommandIdMovement {
        CI_M_NONE = 0,
        CI_M_ADD_KEYFRAME = 1,
        CI_M_PAUSE_MOV = 2,
        CI_M_RESUME_MOV = 3,
        CI_M_PAUSE_INTERPOLATE = 4,
        CI_M_RESUME_INTERPOLATE = 5,
        CI_M_CLEAR_MOV = 6,
        CI_M_CLEAR_PAUSED = 7,
        CI_M_CLEAR_ALL = 8,
        CI_M_QUERY = 9,
        CI_M_COUNT = 9
    };
}
