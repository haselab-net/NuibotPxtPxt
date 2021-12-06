/// <reference path="../../built/pxtlib.d.ts" />

import * as React from 'react';
import {connect, MqttClient, IClientOptions, Packet} from 'mqtt'

enum ConnectionStatus {
    connecting = 0,
    connected = 1,
    failed = 2
}

interface MQTTMessage {
    event: string;
    value1: string;
    value2: string;
    value3: string;
}

interface MessagesTableProps {
    messages: {
        time: Date;
        content: MQTTMessage | Buffer;
    }[];
    event: string
}

class MessagesTable extends React.Component<MessagesTableProps, {}> {
    readonly maxRows = 8
    constructor(props: MessagesTableProps) {
        super(props);
    }
    renderHeader() {
        return (
            <thead>
                <tr key="header1">
                    <th rowSpan={2} key="time">{lf("Time")}</th>
                    <th colSpan={4} key="message">{lf("Messages")}</th>
                </tr>
                <tr key="header2">
                    <th key="event">{"event"}</th>
                    <th key="value1">{"value1"}</th>
                    <th key="value2">{"value2"}</th>
                    <th key="value3">{"value3"}</th>
                </tr>
            </thead>
        )
    }
    renderBody() {
        let rows: JSX.Element[] = []
        for (const message of this.props.messages.slice(-this.maxRows)) {
            let content: JSX.Element | JSX.Element[];
            let invalid: boolean;
            let isEvent: boolean = false;
            if (message.content instanceof Buffer || message.content.event === undefined) {
                content = <td colSpan={4} key="message">{lf("Invalid message")}</td>
                invalid = true
            }
            else {
                content = [
                    <td key="event">{message.content.event}</td>,
                    <td key="value1">{message.content.value1}</td>,
                    <td key="value2">{message.content.value2}</td>,
                    <td key="value3">{message.content.value3}</td>
                ]
                invalid = false

                if (message.content.event === this.props.event) {
                    isEvent = true
                }
            }

            let rowType = ""
            if (isEvent) {
                rowType = "positive"
            } else if (invalid) {
                rowType = "error"
            }

            const row: JSX.Element = (
                <tr key={message.time.toISOString()} className={rowType}>
                    <td>{message.time.toLocaleString()}</td>
                    {content}
                </tr>
            )
            rows.push(row)
        }
        return (
            <tbody>
                {rows}
            </tbody>
        )
    }
    render() {
        return (
            <table className="ui celled table structured">
                {this.renderHeader()}
                {this.renderBody()}
            </table>
        )
    }
}

interface MQTTStateProps {
    nuibotId: string;
    event: string;
}

interface MQTTStateState {
    connectionStatus: ConnectionStatus;
    messages: {
        time: Date;
        content: MQTTMessage | Buffer;
    }[]
}

export class MQTTState extends React.Component<MQTTStateProps, MQTTStateState> {
    connectTimeoutHandler: number | undefined;
    readonly connectTimeoutMs: number = 5 * 1000;
    readonly reconnectPeriodMs: number = 10 * 1000

    readonly mqttServerAddress: string = pxt.appTarget.softRobot.mqttHttpServer
    mqttClient: MqttClient

    constructor(props: MQTTStateProps) {
        super(props);

        console.log(props.nuibotId)
        console.log(props.event)
        this.state = {
            connectionStatus: ConnectionStatus.connecting,
            messages: []
        }

        this.onConnected = this.onConnected.bind(this);
        this.onFailed = this.onFailed.bind(this);
        this.onReconnect = this.onReconnect.bind(this);
        this.onMessage = this.onMessage.bind(this);

        // connect to mqtt
        const options: IClientOptions = {
            connectTimeout: this.connectTimeoutMs,
            reconnectPeriod: this.reconnectPeriodMs,
            clientId: props.nuibotId + "_mqtt_inspector"
        }
        this.mqttClient = connect(this.mqttServerAddress, options)
        this.mqttClient.on('connect', this.onConnected)
        this.mqttClient.on('reconnect', this.onReconnect)
        this.mqttClient.on('offline', this.onFailed)
        this.mqttClient.on('message', this.onMessage)
        this.mqttClient.on('error', (e) => {console.log(e)})

        this.connectTimeoutHandler = window.setTimeout(this.onFailed, this.connectTimeoutMs)
    }

    componentWillUnmount() {
        if (this.connectTimeoutHandler !== undefined) {
            clearTimeout(this.connectTimeoutHandler)
        }

        this.mqttClient.end()
    }

    onReconnect() {
        this.connectTimeoutHandler = window.setTimeout(this.onFailed, this.connectTimeoutMs)

        this.setState({
            connectionStatus: ConnectionStatus.connecting
        })
    }
    onConnected() {
        if (this.connectTimeoutHandler !== undefined) {
            clearTimeout(this.connectTimeoutHandler)
            this.connectTimeoutHandler = undefined
        }

        this.mqttClient.subscribe(this.props.nuibotId)

        this.setState({
            connectionStatus: ConnectionStatus.connected
        })
    }
    onFailed() {
        this.setState({
            connectionStatus: ConnectionStatus.failed
        })
        this.connectTimeoutHandler = undefined
    }
    onMessage(topic: string, payload: Buffer, packet: Packet) {
        function getMessage(payload: Buffer): MQTTMessage | undefined {
            try {
                const message = JSON.parse(payload.toString())
                const keys = ["event", "value1", "value2", "value3"]
                let res: any = {}
                for (const key of keys) {
                    res[key] = message[key]
                }
                return res as MQTTMessage
            } catch (e) {
                return undefined
            }
        }

        const message = getMessage(payload)
        const messages = this.state.messages
        messages.push({
            time: new Date(),
            content: message === undefined ? payload : message
        })
        this.setState({
            messages: messages
        })
        console.log(message)
    }

    renderContent() {
        switch (this.state.connectionStatus) {
            case ConnectionStatus.connecting:
                return this.renderConnectingStatus();
            case ConnectionStatus.connected:
                return this.renderConnectedStatus();
            case ConnectionStatus.failed:
                return this.renderFailedStatus();

        }
    }
    renderConnectingStatus() {
        return (
            <div className="ui segment" style={{height: 100}}>
                <div className="ui active dimmer">
                    <div className="ui text loader">{lf("Connecting to server")}</div>
                </div>
            </div>
        )
    }
    renderConnectedStatus() {
        return <MessagesTable messages={this.state.messages} event={this.props.event} />
    }
    renderFailedStatus() {
        return (
            <div className="ui segment">
                <button
                    className="ui button"
                    onClick={() => this.mqttClient.reconnect()}
                >
                    <i className="huge icons">
                        <i className="red big circle outline icon"></i>
                        <i className="red sync icon"></i>
                    </i>
                </button>
                <h2>{lf("Connect faild, reconnect after ") + this.reconnectPeriodMs.toString() + lf(" ms, click to try again")}</h2>
            </div>
        )
    }

    render() {
        const content: JSX.Element = this.renderContent();
        return content
    }
}
