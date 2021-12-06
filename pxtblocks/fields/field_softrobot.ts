/// <reference path="../../localtypings/blockly.d.ts" />
/// <reference path="../../built/softrobot.d.ts" />

/**
 * Fields for changing motor parameters
 */
namespace pxtblockly {
    /**
     * support functions for fields for pxsim.motor namespace
     */
    namespace motor {
        export function getFieldByName(block: Blockly.Block, name: string): Blockly.Field {
            if (!block) {
                console.log("Not a block");
                return undefined;
            }
            for (let i = 0; i < block.inputList.length; i++) {
                const input = block.inputList[i];
                for (let j = 0; j < input.fieldRow.length; j++) {
                    const field = input.fieldRow[j];
                    if (field.name === name) {
                        return field;
                    }
                }
            }
            // console.log(`Unable to find field with name: ${name}`);
            return undefined;
        }

        /**
         * set motor parameter value to cached value in robotState
         * @param block the block contains the value field
         */
        export function setMotorParamDefaultValue(block: Blockly.Block) {
            let motorIdField = getFieldByName(block, "motor");
            if (!motorIdField) return;
            let motorId = parseInt(motorIdField.getValue());

            let motorParamTypeField = getFieldByName(block, "parameterType");
            if (!motorParamTypeField) return;
            let motorParamType: string = motorParamTypeField.getValue().replace(/["`]+/g, "");

            let motorParamValueField = getFieldByName(block, "value");
            if (!motorParamValueField) return;
            motorParamValueField.setValue(softrobot.device.robotState.motor[motorId][motorParamType].toString());
        }
    }

    /**
     * Field for change the parameter of motor of softrobot with slider
     * @description when the value in block is changed,
     * the hardware would be informed and change its corresponding parameter of selected motor simultaneously
     */
    function haveProp(obj: any): boolean {
        return !!obj || obj == 0;
    }

    export interface FieldMotorParamOptions extends Blockly.FieldCustomOptions {
        onParamChange(inst: softrobot.message_command.IMotorInstruction): Promise<void>;
        type?: string;              // type of parameter in robot control | "auto" (choose through motor param type field)
        default?: string;           // default value of the field
        min?: string;
        max?: string;
        step?: string;
        isActive?: string;          // '1': inform robot to change in real-time when value of the field is changed, '': not inform
    }
    export class FieldMotorParam extends Blockly.FieldSlider implements Blockly.FieldCustom {
        public isFieldCustom_ = true;
        public name = "motorParam";
        private params: FieldMotorParamOptions;

        constructor(text: string, params: FieldMotorParamOptions, validator?: Function) {
            super(haveProp(params.default) ? parseInt(params.default) : text,
                    haveProp(params.min) ? params.min : '-100',
                    haveProp(params.max) ? params.max : '100',
                    null,
                    haveProp(params.step) ? params.step : '1',
                     'Value', validator);

            this.params = params;

            if (!haveProp(this.params.isActive)) this.params.isActive = 'true';
        }

        /**
         * update cache and inform remote if field isAcive
         * @param newValue new value of the field
         */
        setValue(newValue: string | number): void {
            super.setValue(newValue);
            if (!!this.params &&
                !(softrobot.settings.value.control_mode == softrobot.settings.ControlMode.Synchronization_Mode) &&     // synchonise use command in simulator to control robot
                this.parseBoolean(this.params.isActive) &&        // real-time inform is allowed in setting
                !!this.sourceBlock_.parentBlock_                  // the block have an parent block
                ) {
                let motor: string = this.getMotor();
                if (!motor) return;
                let motorId: number = motor ? parseInt(motor.substr(motor.length - 1)) : 0;
                let inst: softrobot.message_command.IMotorInstruction = {
                    motorId: motorId
                }
                if (!this.params.type) {
                    inst.pose = parseInt(this.getValue());
                    this.params.onParamChange(inst);
                }
                else {
                    switch (this.params.type) {
                        case "pose":
                        case "velocity":
                        case "lengthMin":
                        case "lengthMax":
                        case "controlK":
                        case "controlB":
                        case "controlA":
                        case "torqueMin":
                        case "torqueMax":
                            inst[this.params.type] = parseInt(this.getValue());
                            break;
                        case "auto":
                            let pt = this.getMotorParamType();
                            if (!pt) return;
                            let key: number = parseInt(pt);
                            let array = Object.keys(softrobot.device.robotState.motor[0]);
                            inst[array[key]] = parseInt(this.getValue());
                            break;
                        default:
                            console.log("FieldMotorParam: wrong type");
                            break;
                    }
                    this.params.onParamChange(inst);
                }
            }
        }

        private getMotor (): string {
            let field: Blockly.Field = motor.getFieldByName(this.sourceBlock_, "motor");
            if (!field) return undefined;
            return field.getValue();
        }

        private getMotorParamType(): string {
            let field: Blockly.Field = motor.getFieldByName(this.sourceBlock_, "parameterType");
            if (!field) return undefined;
            return field.getValue();
        }

        private parseBoolean(val: string): boolean {
            if (val == 'true') return true;
            else return false;
        }
    }

    /**
     * Field for change the motor with a dropdown
     * @description When the available motors on hardware are changed, 
     * the available options in the dropdown would change
     */
     export interface FieldMotorOptions extends Blockly.FieldCustomDropdownOptions {
         getNMotor: () => number;
     }

     export class FieldMotor extends Blockly.FieldDropdown implements Blockly.FieldCustom {
         public isFieldCustom_ = true;
         private nMotor = 3;

         constructor(text: string, params: FieldMotorOptions, validator?: Function) {
            super(function() {
                let res: (string)[][] = new Array();
                this.nMotor = params.getNMotor();
                for (let index = 0; index < this.nMotor; index++) {
                    res.push([lf("Motor") + " " + index.toString(), index.toString()])
                }
                return res;
            }, validator);
         }

         /**
          * change value field according to cached value when field changed 
          */
         setValue(newValue: string | number) {
            let v: number = typeof newValue === "string" ? parseInt(newValue) : Math.floor(newValue);
            if (isNaN(v)) v = 0;
            else if (v < 0) v = 0;
            else if (v >= this.nMotor) v = this.nMotor - 1;
            super.setValue(v);
            if (this.sourceBlock_) motor.setMotorParamDefaultValue(this.sourceBlock_);
         }
     }

    /**
     * Field to change the motor parameter type
     * @description when the value in drop down changed, change default value according to RobotInfo cache
     */
     export interface FieldMotorParamTypeOptions extends Blockly.FieldCustomDropdownOptions {
        dpArray: string;  // array of available motor parameter types (keys of MotorState) in the dropdown (empty array means all available)
     }

     export class FieldMotorParamType extends Blockly.FieldDropdown implements Blockly.FieldCustom {
         public isFieldCustom_ = true;
         public name = "motorParamType";

         static indexMap: {[key: string]: string} = {        // the correlation between [object index of parameter] and [display items of dropdown]
             pose: lf("pose"),
             velocity: lf("velocity"),
             lengthMin: lf("lengthMin"),
             lengthMax: lf("lengthMax"),
             controlK: lf("controlK"),
             controlB: lf("controlB"),
             controlA: lf("controlA"),
             torqueMin: lf("torqueMin"),
             torqueMax: lf("torqueMax")
         }
         // find key with value
         static findIndex(target: string): string {
            for (let key in FieldMotorParamType.indexMap) {
                if (FieldMotorParamType.indexMap[key] === target) {
                    return key;
                }
            }
            return undefined;
         }

         constructor(text: string, params: FieldMotorParamTypeOptions, validator?: Function) {
            super(function () {
                let res: (string)[][] = new Array();
                let array = Object.keys(FieldMotorParamType.indexMap);
                let dpArray: string[] = JSON.parse(params.dpArray);
                if (!dpArray || dpArray.length == 0) {
                    array.map(str => res.push([FieldMotorParamType.indexMap[str], str]));
                }
                else {
                    dpArray.forEach(element => {
                        let key = FieldMotorParamType.findIndex(element);
                        if (key !== undefined) {
                            res.push([element, key]);
                        }
                    });
                }
                return res;
            }, validator);
         }

         /**
          * change value field according to cached value when field changed 
          */
         setValue(newValue: string | number) {
            if (typeof newValue === "number") return;
            newValue = newValue.replace(/["`]+/g, "");
            if (FieldMotorParamType.indexMap[newValue] === undefined) return;
            super.setValue(newValue);
            if (this.sourceBlock_) motor.setMotorParamDefaultValue(this.sourceBlock_);
         }

         getValue() {
             return "\"" + super.getValue() + "\"";
         }
     }
}

/**
 * Field for movement input && HTTP Request Param
 */
namespace pxtblockly {
    // TODO support converting JS code to Block code

    export interface FieldMovementOptions {
        showEditor: (currentValue: string, setValue: (newValue: string) => void) => void;
        convertDisplayString?: (str: string) => string;
    }

    export class FieldMovement extends Blockly.Field implements Blockly.FieldCustom {
        public isFieldCustom_ = true;

        private elt: Element;           // html element in field
        private fieldRect: SVGRectElement;
        private fieldText: SVGTextElement;

        private textMarginLeft: number = 10;
        private textMarginTop: number = 5;
        private textMaxLength: number = 20;
        private boxMarginTop: number = 5;
        private boxMarginLeft: number = 5;

        private codeStr: string = "";
        public defaultText = "default\n2 1 4000\n3 0\n1000 1000\n3000 0";

        private showEditor: (currentValue: string, setValue: (newValue: string) => void) => void;

        constructor(text: string, params: FieldMovementOptions, validator?: Function) {
            super(text, validator);

            this.showEditor = params.showEditor;
            if (params.convertDisplayString) this.convertDisplayString = params.convertDisplayString;

            this.setValue = this.setValue.bind(this);
        }

        showEditor_() {
            this.showEditor(this.codeStr, this.setValue);
        }

        setValue(newValue: string | number, restoreState = true) {
            if (typeof newValue === "number") return;
            super.setValue(newValue);
            if (this.elt) {
                if (restoreState) this.restoreStateFromString();
                this.render_();
                this.sourceBlock_.render();     // update from source block to change the size_
            }
        }

        getValue() {
            let text = removeQuotes(this.getText());
            return `\`${text}\``;
        }

        private restoreStateFromString() {
            let str = this.getText();
            if (str) {
                this.codeStr = removeQuotes(str).replace(/[ \t]{2,}/g, '');
            }
        }

        private convertDisplayString(str: string) {
            let strContent = str.length > this.textMaxLength ? str.slice(0, this.textMaxLength) + " ..." : str;
            return `\" ${strContent} \"`;
        }
        private updateDisplay() {
            let str: string = this.convertDisplayString(this.codeStr);
            this.fieldText.textContent = str;
            let textBBox = this.fieldText.getBBox();

            let newRectWidth = textBBox.width + 2 * this.textMarginLeft;
            let newRectHeight = textBBox.height + 2 * this.textMarginTop;
            this.fieldRect.setAttribute("width", newRectWidth.toString());
            this.fieldRect.setAttribute("height", newRectHeight.toString());

            let textY: number = newRectHeight / 2 + this.boxMarginTop;
            this.fieldText.setAttribute("x", this.textMarginLeft.toString());
            this.fieldText.setAttribute("y", textY.toString());
        }

        private initFieldDisplay() {
            this.elt = pxsim.svg.parseString(`<svg xmlns="http://www.w3.org/2000/svg" id="field-movement" />`);
            this.elt.setAttribute("x", this.boxMarginLeft.toString());
            this.elt.setAttribute("y", this.boxMarginTop.toString());

            this.restoreStateFromString();

            this.fieldRect = <SVGRectElement>pxsim.svg.child(this.elt, "rect", {
                width: "100",
                height: "50",
                style: "fill:rgb(255,255,255);stroke-width:3;stroke:rgb(0,0,0)"
            });
            this.fieldText = <SVGTextElement>pxsim.svg.child(this.elt, "text", {
                x: "50",
                y: "25"
            });

            this.updateDisplay();

            this.elt.addEventListener("click", () => this.showEditor_.bind(this));
            this.fieldGroup_.appendChild(this.elt);
        }

        render_() {
            if (!this.visible_) {
                this.size_.width = 0;
                return;
            }

            if (!this.elt) {
                this.initFieldDisplay();
            } else {
                this.updateDisplay();

                this.size_.width = parseFloat(this.fieldRect.getAttribute("width")) + 2 * this.boxMarginLeft;
                this.size_.height = parseFloat(this.fieldRect.getAttribute("height")) + 2 * this.boxMarginTop;
            }

            if (this.box_) {
                console.log("set box: ", this.size_);
                this.box_.setAttribute('width', `${this.size_.width}`);
                this.box_.setAttribute('height', `${this.size_.height}`);
            }
        }
    }

    const allQuotes = ["'", '"', "`"];

    export function removeQuotes(str: string) {
        str = str.trim();
        const start = str.charAt(0);
        if (start === str.charAt(str.length - 1) && allQuotes.indexOf(start) !== -1) {
            return str.substr(1, str.length - 2).trim();
        }
        return str;
    }
}

/**
 * Field for change the length of motor of softrobot with slider
 * @description When the length in the block is changed, 
 * the hardware (softrobot) will change its length of corresponding motor simultaneously 
 * @deprecated use FieldMotorParam with type "pose" instead 
 */
 namespace pxtblockly {
    export interface FieldLengthOptions extends Blockly.FieldCustomOptions {
        onLengthChange(inst: softrobot.message_command.IMotorInstruction): Promise<void>;
        default?: string;
        min?: string;
        max?: string;
        step?: string;
    }

    export class FieldLength extends Blockly.FieldSlider implements Blockly.FieldCustom {
        public isFieldCustom_ = true;
        public name = "length";
        private params: FieldLengthOptions;

        constructor(text: string, params: FieldLengthOptions, validator?: Function) {
            super(text, '-100', '100', null, '1', 'Value', validator);
            this.params = params;

            if (this.params.min) this.min_ = parseInt(this.params.min);
            if (this.params.max) this.max_ = parseInt(this.params.max);
            if (this.params.step) this.step_ = parseInt(this.params.step);
        }

        setValue(newValue: string | number): void {
            super.setValue(newValue);
            if (!!this.params) {
                let motor: string = this.getMotor();
                let motorId: number = motor ? parseInt(motor.substr(motor.length - 1)) : 0;
                this.params.onLengthChange({
                    motorId: motorId,
                    pose: parseInt(this.getValue())
                })
            }
        }

        private getFieldByName(name: string): Blockly.Field {
            const parentBlock = this.sourceBlock_;
            if (!parentBlock) return undefined; // warn
            for (let i = 0; i < parentBlock.inputList.length; i++) {
                const input = parentBlock.inputList[i];
                for (let j = 0; j < input.fieldRow.length; j++) {
                    const field = input.fieldRow[j];
                    if (field.name === name) {
                        return field;
                    }
                }
            }
            return undefined;
        }

        private getMotor (): string {
            let field: Blockly.Field = this.getFieldByName("motor");
            if (!field) {
                console.log("pxtblockly.FieldLength::getMotor(): Unable to find motor field in the same block");
                return undefined;
            }
            return field.getValue();
        }
    }
}