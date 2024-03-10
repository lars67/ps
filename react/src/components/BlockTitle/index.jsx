import React from 'react';


import './BlockTitle.css';

export default function Index({
  size, color, backgroundColor, width, children, ...rest
}) {
  const styles = {
    size: Index.sizes[size],
    borderBottomColor: backgroundColor,
    color,
    width,
    fontSize: Index.fontSizes[size],
  };

  const trapezoid = `trapezoid-${size}`;
  return (
    <div className="block-title-holder" {...rest}>
      <div className={trapezoid} style={styles}>
        {children}
      </div>
    </div>
  );
}



Index.defaultProps = {
  children: null,
  color: '#FFF',
  backgroundColor: '#008',
  size: 'normal',
  width: '100px',
};

Index.sizes = {
  small: '16px',
  normal: '24px',
  large: '32px',
};

Index.fontSizes = {
  small: '12px',
  normal: '18px',
  large: '24px',
};

