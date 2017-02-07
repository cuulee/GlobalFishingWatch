import React from 'react';
import classNames from 'classnames';
import accordionStyles from 'styles/components/map/c-accordion.scss';

class AccordionItem extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      opened: props.opened === undefined ? false : props.opened
    };
    // Bindings
    this.toggle = this.toggle.bind(this);
  }

  toggle() {
    if (this.state.opened) this.props.onClose(this.props.itemKey);
    else this.props.onOpen(this.props.itemKey);
  }

  render() {
    const cNames = classNames(accordionStyles['c-accordion-item'], {
      [this.props.className]: this.props.className
    });
    return (
      <div className={cNames}>
        <div className={accordionStyles['accordion-item-header']} onClick={this.toggle}>
          {this.props.title && this.props.title}
        </div>
        <div
          className={classNames(accordionStyles['accordion-item-content'],
          { [`${accordionStyles['-closed']}`]: !this.state.opened })}
        >
          {this.props.children}
        </div>
      </div>
    );
  }
}

AccordionItem.propTypes = {
  itemKey: React.PropTypes.number,
  opened: React.PropTypes.bool,
  title: React.PropTypes.object,
  className: React.PropTypes.string,
  children: React.PropTypes.object,
  toggleIcon: React.PropTypes.object,
  onOpen: React.PropTypes.func,
  onClose: React.PropTypes.func
};
