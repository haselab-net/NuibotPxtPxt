import * as React from 'react';

class SubmitCache<T> {
    private value: T
    private timeoutHandler: NodeJS.Timer = undefined

    constructor(private submit: (value: T) => void,
                private duration: number) {
    }
    setValue(value: T) {
        this.value = value
        if (this.timeoutHandler === undefined) {
            this.timeoutHandler = setTimeout(this.submitCache, this.duration)
        } else {
            clearTimeout(this.timeoutHandler)
            this.timeoutHandler = setTimeout(this.submitCache, this.duration)
        }
    }
    clearCache() {
        if (this.timeoutHandler !== undefined) {
            clearTimeout(this.timeoutHandler)
            this.timeoutHandler = undefined
        }
    }
    private submitCache = () => {
        this.submit(this.value)
        this.timeoutHandler = undefined
    }
}

type ValueType = string | number | string[]

export type InputSubmitterProps = {
    submitChange: (value: string) => void
    forwardedRef?: React.Ref<HTMLInputElement>
} & React.InputHTMLAttributes<HTMLInputElement>

interface InputSubmitterState {
    value: string
}

class InputSubmitter extends React.Component<InputSubmitterProps, InputSubmitterState> {
    private lastProp = this.props.value

    private submit = (value: string) => {
        this.submitCache.clearCache()
        if (value === this.props.value.toString()) return

        this.props.submitChange(value)
        console.log("submitChange", value)
        this.setState({
            value: this.props.value.toString()
        })
    }

    private submitCache = new SubmitCache<string>(this.submit, 1000)

    constructor(props: InputSubmitterProps) {
        super(props)

        this.state = {
            value: props.value.toString()
        }
    }

    private onInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value
        this.setState({ value: value})
        this.submitCache.setValue(value)
    }

    componentDidUpdate() {
        if (this.props.value !== this.lastProp) {
            this.setState({ value: this.props.value.toString() })
            this.lastProp = this.props.value
        }
    }

    render() {
        const {
            value,
            onKeyDown,
            onBlur,
            submitChange,
            forwardedRef,
            ...restProps
        } = this.props

        return (
            <input
            {...restProps}
            ref={forwardedRef}
            onChange={this.onInputChange}
            onBlur={(event: React.FocusEvent<HTMLInputElement>) => {
                console.log("onBlur")
                this.submit(this.state.value)
                if (onBlur) {
                    onBlur(event)
                }
            }}
            value={this.state.value}
            onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
                if (event.key === 'Enter') {
                    console.log("enter")
                    this.submit(this.state.value)
                }
                if (onKeyDown) {
                    onKeyDown(event)
                }
            }}
          />
        )
    }
}

const InputSubmitterWithRef = React.forwardRef((props: InputSubmitterProps, ref: React.Ref<HTMLInputElement>) => {
    return <InputSubmitter {...props} forwardedRef={ref} />
})

export default InputSubmitterWithRef
