import * as React from 'react';

interface DividerDropdownProps {
    title: string;
}
interface DividerDropdownState {
    hidden: boolean;
}
export class DividerDropdown extends React.Component<DividerDropdownProps, DividerDropdownState> {
    constructor(props: DividerDropdownProps){
        super(props);
        this.state = {
            hidden: true
        }
    }
    render() {
        return [
            (
                <div key="divider" className="ui horizontal divider sr-clickable" onClick={() => this.setState({ hidden: !this.state.hidden })}>
                    {this.state.hidden ? <i className="caret right icon" /> : <i className="caret down icon" />}
                    {this.props.title}
                </div>
            ),
            (
                this.state.hidden ? undefined : this.props.children
            )
        ]
    }
}
