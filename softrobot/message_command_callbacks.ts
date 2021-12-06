namespace softrobot.message_command.callbacks {
    /**
     * Sample
     */
     // settings of callback
    export interface IThresholdCallback {
        sensorId: number;           // id of sensor
        threshold: number;          // threshold of the callback
        exceed: boolean;            // true: called when value first exceed threshold; false: called when value first fall behind of threshold
    }

    /**
     * Touch sensor callback
     */
    export interface ITouchThresholdCallback extends IThresholdCallback {

    }
    export let touchThresholdArray: ITouchThresholdCallback[] = [];
    export let callTouchCallback: (key: ITouchThresholdCallback, args: any[]) => void = undefined;
    export let touchQueryer: any = undefined;           // Interval for query touch sensor
    export let touchQueryerInterval: number = 500;      // REVIEW test previous interval 500ms
    export let onRcvTouchMessage: (oldValue: number[], newValue: number[]) => void = (oldValue: number[], newValue: number[]) => {
        // no callbacks
        if (!callTouchCallback) return;

        // find whether have satisfied threshold
        for (let i = 0; i < touchThresholdArray.length; i++) {
            let threshold = touchThresholdArray[i];
            if (threshold.sensorId >= oldValue.length) {
                console.log(`No touch sensor with id ${threshold.sensorId}`);
                continue;
            }

            let oldV = oldValue[threshold.sensorId], newV = newValue[threshold.sensorId];
            let lowV = oldV > newV ? newV : oldV, highV = oldV > newV ? oldV : newV;
            if (lowV >= threshold.threshold || highV < threshold.threshold) continue;
            if ((newV > oldV) !== threshold.exceed) continue;

            console.log("with rcv touch message: ", oldValue, newValue, ", touch threshold is called: ", touchThresholdArray[i]);

            callTouchCallback(threshold, []);
        }
    }
}