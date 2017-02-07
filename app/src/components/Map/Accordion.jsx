import React from 'react';
import classNames from 'classnames';
import accordionStyles from 'styles/components/map/c-accordion.scss';

export default class Accordion extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      activeItems: []
    };
    // Bindings
    this.openItem = this.openItem.bind(this);
    this.closeItem = this.closeItem.bind(this);
  }

  openItem(index) {
    if (this.props.allowMultiple) this.setState({ activeItems: [...this.state.activeItems, index]});
    else this.setState({ activeItems: [index]});
  }

  closeItem(index) {
    const items = [...this.state.activeItems];
    items.filter(item => item !== index);
    this.setState({ activeItems: items })
  }


  isItemOpen(index) {
    return this.state.activeItems.includes(index);
  }

  render() {
    const cNames = classNames(accordionStyles['c-accordion'], {
      [this.props.className]: this.props.className
    });
    const items = this.props.items;

    const content = items.map((item, index) => {
      return (
        <AccordionItem
          key={index}
          itemKey={index}
          title={item.title}
          toggleIcon={item.toggleIcon}
          className={item.className}
          opened={this.isItemOpen(index)}
          onOpen={this.openItem}
          onClose={this.closeItem}
        >
          {item.content}
        </AccordionItem>
      );
    });

    return (
      <div className={cNames}>
        {content}
      </div>
    );
  }
}

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
        <div className={classNames(accordionStyles['accordion-item-content'],
          {[`${accordionStyles['-closed']}`]: !this.state.opened})}>
          {this.props.children}
        </div>
      </div>
    );
  }
}

Accordion.propTypes = {
  allowMultiple: React.PropTypes.bool,
  items: React.PropTypes.array,
  className: React.PropTypes.string
};

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
