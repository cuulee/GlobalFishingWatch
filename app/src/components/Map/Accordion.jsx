import React from 'react';
import classNames from 'classnames';
import accordionStyles from 'styles/components/map/c-accordion.scss';
import AccordionItem from 'components/Map/AccordionItem';

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
    if (this.props.allowMultiple) this.setState({ activeItems: [...this.state.activeItems, index] });
    else this.setState({ activeItems: [index] });
  }

  closeItem(index) {
    const items = [...this.state.activeItems];
    items.filter(item => item !== index);
    this.setState({ activeItems: items });
  }


  isItemOpen(index) {
    return this.state.activeItems.includes(index);
  }

  render() {
    const cNames = classNames(accordionStyles['c-accordion'], {
      [this.props.className]: this.props.className
    });
    const items = this.props.items;

    const content = items.map((item, index) => (
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
    ));

    return (
      <div className={cNames}>
        {content}
      </div>
    );
  }
}

Accordion.propTypes = {
  allowMultiple: React.PropTypes.bool,
  items: React.PropTypes.array,
  className: React.PropTypes.string
};
