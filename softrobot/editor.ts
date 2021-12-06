/**
 * Handle events in pxt block editor
 */

namespace softrobot.editor {
    /**
     * Function called when movement field is clicked
     */
    export let onFieldMovementClicked: (currenValue: string, setValue: (newValue: string) => void) => void = (currentValue: string, setValue: (newValue: string) => void) => {
        console.warn("function onFieldMovementClicked should be overwritten");
    };   // overwritten in softrobot.tsx

    /**
     * Function called when http param
     * @param currentValue the current value to be showed on the editor
     * @param setValue the function used to set value input on the editor
     */
    export let onFieldHTTTPParamClicked: (currenValue: string, setValue: (newValue: string) => void) => void = (currentValue: string, setValue: (newValue: string) => void) => {
        console.warn("function onFieldHTTTPParamClicked should be overwritten");
    };   // overwritten in softrobot.tsx

    /**
     * Show dialog to test Webhook
     */
    export let showWebhookTester: (header: string, url: string, params: string[][]) => void = (header: string, url: string, params: string[][]) => {
        console.warn("function showWebhookTester should be overwritten");
    };

    /**
     * Show dialog to listening MQTT
     */
    export let showMQTTTester: (nuibotId: string, event: string) => void = (nuibotId: string, event: string) => {
        console.warn("function showMQTTTester should be overwritten");
    };
}
