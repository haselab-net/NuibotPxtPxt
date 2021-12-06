import * as core from "../core";
import * as mobx from "mobx";

export function init() {
    softrobot.socket.onRcvOTA = () => {
        core.warningNotification(lf("Prepare to update firmware, DO NOT shut down Nuibot or close wifi"))
    };

    mobx.autorun(() => {
        if (softrobot.device.robotInfo.firmwareInfo.version !== "unknown") {
            checkUpdate()
        }
    })
}

class Version {
    versionType: string
    major: number
    minor: number
    patch: number
    releaseType: string
    private regex = /^(.*)([0-9]+)\.([0-9]+)\.([0-9]+)(.*)$/
    constructor(firmwareVersion: string) {
        firmwareVersion = firmwareVersion.trim()
        console.assert(this.regex.test(firmwareVersion))

        const matches = this.regex.exec(firmwareVersion)
        this.versionType = matches[1] ? matches[1] : ""
        this.major = parseInt(matches[2])
        this.minor = parseInt(matches[3])
        this.patch = parseInt(matches[4])
        this.releaseType = matches[5] ? matches[5] : ""
    }

    largerThan(version: Version): boolean {
        if (this.major < version.major) return false;
        else if (this.major > version.major) return true;

        if (this.minor < version.minor) return false;
        else if (this.minor > version.minor) return true;

        if (this.patch <= version.patch) return false;
        else return true;
    }

    equalTo(version: Version): boolean {
        return this.major === version.major && this.minor === version.minor && this.patch === version.patch
    }
}

export function checkUpdate() {
    retrieveFirmwareVersion().then(latestFirmwareVersion => {
        if (pxt.appTarget.softRobot.noUpdateFirmwarePopup) {
            return
        }

        const latestVersion = new Version(latestFirmwareVersion)
        const currentVersion = new Version(softrobot.device.robotInfo.firmwareInfo.version)

        // new version available
        if (shouldUpdateFirmware(currentVersion, latestVersion)) {
            const otaVersion = new Version("2.1.0")
            const compatibleVersion = new Version("2.1.4")

            // need manual update
            if (otaVersion.largerThan(currentVersion)) {
                core.confirmAsync({
                    hideCancel: true,
                    header: lf("Update firmware"),
                    agreeLbl: lf("Redirect"),
                    agreeClass: "positive",
                    agreeIcon: "checkmark",
                    body: lf("Unsupported firmware, please contact us ({0}) to update firmware. Browser would redirect to old compatible web application now.", ["nuigurumirobotics@gmail.com"]),
                    size: "large"
                }).then((update: number) => {
                    window.location.host = "old.nuibot.haselab.net"
                })
            }
            // could update by ota
            else if (compatibleVersion.largerThan(currentVersion)) {
                core.confirmAsync({
                    hideCancel: true,
                    header: lf("Update firmware"),
                    agreeLbl: lf("Update firmware"),
                    agreeClass: "positive",
                    agreeIcon: "checkmark",
                    body: lf("New firmware available. (Update takes about 5 minutes, Nuibot would be unpaired.)"),
                    size: "large"
                }).then((update: number) => {
                    softrobot.socket.sendAsync(softrobot.command.PacketId.PI_OTA, undefined)
                })
            }
            // no update also works
            else {
                showFirmwareUpdateDialog()
            }
        }
    })
}

export function retrieveFirmwareVersion(): Promise<string> {
    const firmwareVersionUrl = pxt.appTarget.softRobot.firmwareVersionServer
    const http = new XMLHttpRequest()
    http.open('GET', firmwareVersionUrl)
    http.send()

    return new Promise((resolve, reject) => {
        const handle = setTimeout(() => reject("time out"), 2000)
        http.onreadystatechange = (event) => {
            if (http.readyState === 4) {
                const latestFirmwareVersion = http.responseText;
                clearTimeout(handle)
                return resolve(latestFirmwareVersion)
            }
        }
    })
}

export function shouldUpdateFirmware(localVersion: string | Version, remoteVersion: string | Version) {
    const local = typeof localVersion === 'string' ? new Version(localVersion.trim()) : localVersion
    const remote = typeof remoteVersion === 'string' ? new Version(remoteVersion.trim()) : remoteVersion

    return remote.releaseType === "r" && (remote.largerThan(local) || (remote.equalTo(local) && local.releaseType !== "r"))
}

export function showFirmwareUpdateDialog() {
    core.confirmAsync({
        hideCancel: false,
        header: lf("Update firmware"),
        agreeLbl: lf("Update firmware"),
        agreeClass: "positive",
        agreeIcon: "checkmark",
        disagreeLbl: lf("Keep old firmware"),
        body: "New firmware available. (Update takes about 5 minutes, Nuibot would be unpaired.)",
        size: "large"
    }).then((update: number) => {
        if (update === 1) {
            softrobot.socket.sendAsync(softrobot.command.PacketId.PI_OTA, undefined)
        }
    })
}
