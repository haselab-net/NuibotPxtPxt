import * as mobx from 'mobx'

function plain2Observable(plain: any) {
    let actions: any = {}
    for (const key of plain) {
        if (plain[key] instanceof Array) {
            continue
        } else if (typeof plain[key] === 'object') {
            const ob = plain2Observable(plain[key])
            plain[key] = ob
        } else if (typeof plain[key] === 'function') {
            actions[key] = mobx.action
        } else {
            continue
        }
    }
    return mobx.observable(plain, actions)
}

export function convertRobotState() {
    const plainObj = softrobot.util.instance2PlainShallow(softrobot.device.robotState)
    softrobot.device.robotState = plain2Observable(plainObj)
}

export function convertRobotInfo() {
    const plainObj = softrobot.util.instance2PlainShallow(softrobot.device.robotInfo)
    softrobot.device.robotInfo = plain2Observable(plainObj)
}

export function convertSocket() {
    softrobot.socket.paired = mobx.observable.box<softrobot.socket.PairStatus>(softrobot.socket.paired.get())
}
