import {connect, MqttClient, IClientOptions, Packet} from 'mqtt'
import {driver} from "../simulator";


let mqttClient: MqttClient = undefined

function bindCallback(client: MqttClient) {
    client.on('message', (topic: string, payload: Buffer) => {
        try {
            const message = JSON.parse(payload.toString())
            let res = {
                event: (message.event || '') as string,
                value1: (message.value1 || '') as string,
                value2: (message.value2 || '') as string,
                value3: (message.value3 || '') as string
            }
            driver.postMessage({
                type: 'softrobot',
                srMessageType: 'mqtt',
                mqtt: {
                    mqttMessage: res
                }
            } as pxsim.SimulatorMessage)
        }
        catch (err) {
            console.error("Unable to convert mqtt message to js object.", err)
        }
    })
    client.on('connect', () => {
        const topic = softrobot.util.macAddress2NuibotId(softrobot.device.robotInfo.macAddress)
        client.subscribe(topic)
    })
    client.on('error', (e) => {console.log("mqtt error", e)})
}

function endMqttClient() {
    if (mqttClient !== undefined) {
        mqttClient.end()
        mqttClient = undefined
    }
}

export function init() {
    softrobot.sim.mqttHandler = function(msg: softrobot.sim.SrSimulatorMessage) {
        switch (msg.mqtt.command) {
            case 'start':
                const serverAddr = msg.mqtt.address ? msg.mqtt.address : pxt.appTarget.softRobot.mqttHttpServer
                const clientName = softrobot.util.macAddress2NuibotId(softrobot.device.robotInfo.macAddress) + "_simulator"

                if (mqttClient !== undefined) {
                    endMqttClient()
                }

                mqttClient = connect(serverAddr, {
                    clientId: clientName
                })
                bindCallback(mqttClient)
                break
            case 'end':
                endMqttClient()
                break
            default:
                console.error(`Undefined mqtt command: ${msg.mqtt.command}`)
                break
        }
    }
}
