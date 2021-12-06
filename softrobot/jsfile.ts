namespace softrobot.jsfile {
    export let main_prefix = ' \
    var jslib = require("jslib"); \
    var softrobot = require("sr_softrobot"); \
    var loops = require("sr_loops"); \r\n ' ;

    export let main_suffix = ' \
    jslib.registerCallback(function(data){ \
        let p = softrobot.packet_command.Packet.fromBinary(data.slice(2)); \
        if (!p) { \
            console.log("Jsfile Callback: Unable to convert Arraybuffer to Packet"); \
            return; \
        } \
        softrobot.message_command.messageHandler(p); \
        console.log("Jsfile Callback: callback called"); \
    }); \
     \
    loops.doForever();' ;
}