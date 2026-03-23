import React from 'react';
import classnames from 'classnames';
import { usePagination, DOTS } from './usePagination';
import './pagination.css';

import { v4 } from 'uuid'
const Pagination = props => {
  const {
    onPageChange,
    totalCount,
    siblingCount = 1,
    currentPage,
    pageSize,
    className
  } = props;

  const paginationRange = usePagination({
    currentPage,
    totalCount,
    siblingCount,
    pageSize
  });

  if (currentPage === 0 || paginationRange.length < 2) {
    return null;
  }

  const onNext = () => {
    onPageChange(currentPage + 1);
  };

  const onPrevious = () => {
    onPageChange(currentPage - 1);
  };

  let lastPage = paginationRange[paginationRange.length - 1];
  return (
    <ul className={classnames('pagination-container', { [className]: className })} style={{marginTop : "15px"}}>
      <li className={classnames('pagination-container pagination-item', {disabled: currentPage === 1})} onClick={onPrevious}>
        <div className="pagination-container pagination-item arrow left" />
      </li>
        {paginationRange.map(pageNumber => {
          if (pageNumber === DOTS) {
            return <li className="pagination-container pagination-item dots" key={v4()}>&#8230;</li>;
          }

          return (
            <li key={v4()} className={classnames('pagination-container pagination-item', {selected: pageNumber === currentPage})} onClick={() => onPageChange(pageNumber)}>
              {pageNumber}
            </li>
          );
        })}
      <li className={classnames('pagination-container pagination-item', {disabled: currentPage === lastPage})} onClick={onNext}>
        <div className="pagination-container pagination-item arrow right" />
      </li>
    </ul>
  );
};

export default Pagination;
