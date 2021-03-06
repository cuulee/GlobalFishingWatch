import PropTypes from 'prop-types';
import React, { Component } from 'react';
import classnames from 'classnames';
import SearchResult from 'containers/Map/SearchResult';
import PaginatorStyles from 'styles/components/shared/c-paginator.scss';
import ReactPaginate from 'react-paginate';
import Rhombus from 'components/Shared/Rhombus';
import { SEARCH_QUERY_MINIMUM_LIMIT, SEARCH_MODAL_PAGE_SIZE } from 'constants';
import ModalStyles from 'styles/components/shared/c-modal.scss';
import ResultListStyles from 'styles/components/shared/c-result-list.scss';
import SearchModalStyles from 'styles/components/map/c-search-modal.scss';
import iconsStyles from 'styles/icons.scss';
import SearchIcon from 'babel!svg-react!assets/icons/search-icon.svg?name=SearchIcon';
import CloseIcon from 'babel!svg-react!assets/icons/close.svg?name=CloseIcon';

class SearchModal extends Component {

  onSearchInputChange(value) {
    this.props.setSearchTerm(value);
  }

  onPageChange(page) {
    this.props.setSearchPage(page);
  }

  cleanResults() {
    this.props.setSearchTerm('');
  }

  render() {
    let searchResults;

    if (this.props.searching) {
      searchResults = <li className={ResultListStyles['status-message']}>Searching...</li>;
    } else if (this.props.count && this.props.searchTerm.length >= SEARCH_QUERY_MINIMUM_LIMIT) {
      searchResults = [];
      for (let i = 0, length = this.props.entries.length; i < length; i++) {
        searchResults.push(<SearchResult
          className={classnames(ResultListStyles['result-item'], SearchModalStyles['search-result-item'])}
          key={i}
          closeSearch={() => this.props.closeSearchModal()}
          vesselInfo={this.props.entries[i]}
        />);
      }
    } else if (this.props.searchTerm.length < SEARCH_QUERY_MINIMUM_LIMIT && this.props.searchTerm.length > 0) {
      searchResults = (
        <li className={ResultListStyles['status-message']}>
          Type at least {SEARCH_QUERY_MINIMUM_LIMIT} characters
        </li>);
    } else {
      searchResults = <li className={ResultListStyles['status-message']}>No result</li>;
    }

    return (
      <div className={SearchModalStyles['c-search-modal']}>
        <h3 className={ModalStyles['modal-title']}>Search vessel</h3>
        <div className={SearchModalStyles['search-container']}>
          <div className={SearchModalStyles['search-input-container']}>
            <input
              className={SearchModalStyles['search-input']}
              onChange={e => this.onSearchInputChange(e.target.value)}
              placeholder="Search vessel"
              value={this.props.searchTerm}
            />
            {this.props.searchTerm.length === 0 && <SearchIcon
              className={classnames(iconsStyles.icon, SearchModalStyles['search-icon'])}
            />}
            {this.props.searchTerm.length > 0 && <CloseIcon
              className={classnames(iconsStyles.icon, iconsStyles['icon-close'], SearchModalStyles['delete-icon'])}
              onClick={() => this.cleanResults()}
            />}
          </div>
          {searchResults && <ul className={classnames(ResultListStyles['c-result-list'], SearchModalStyles['search-result-list'])}>
            {searchResults}
          </ul>
          }
        </div>
        <div className={SearchModalStyles['paginator-container']}>
          <div
            className={PaginatorStyles['c-paginator']}
          >
            {!this.props.searching && this.props.entries.length > 0 && <ReactPaginate
              previousLabel={<Rhombus />}
              nextLabel={<Rhombus />}
              nextClassName={PaginatorStyles.next}
              previousClassName={PaginatorStyles.previous}
              breakLabel={<span>...</span>}
              pageClassName={PaginatorStyles['page-item']}
              breakClassName={PaginatorStyles['page-item']}
              pageCount={Math.ceil(this.props.count / SEARCH_MODAL_PAGE_SIZE)}
              pageRangeDisplayed={3}
              onPageChange={e => this.onPageChange(e.selected)}
              forcePage={this.props.page}
              containerClassName={PaginatorStyles['page-list']}
              activeClassName={PaginatorStyles['-current']}
              disabledClassName={PaginatorStyles['-disabled']}
            />
            }
          </div>
        </div>
      </div>);
  }
}

SearchModal.propTypes = {
  closeSearchModal: PropTypes.func,
  setSearchTerm: PropTypes.func,
  setSearchPage: PropTypes.func,
  /*
   Search results
   */
  entries: PropTypes.array, /*
   Number of total search results
   */
  count: PropTypes.number, /*
   If search is in progress
   */
  searching: PropTypes.bool, /*
   Search term to use
   */
  searchTerm: PropTypes.string,
  page: PropTypes.number
};

export default SearchModal;
