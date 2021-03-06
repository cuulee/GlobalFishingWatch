import PropTypes from 'prop-types';
import React, { Component } from 'react';
import classnames from 'classnames';
import { SEARCH_RESULTS_LIMIT, SEARCH_QUERY_MINIMUM_LIMIT } from 'constants';
import SearchResult from 'containers/Map/SearchResult';
import iconsStyles from 'styles/icons.scss';
import searchPanelStyles from 'styles/components/map/c-search-panel.scss';
import ResultListStyles from 'styles/components/shared/c-result-list.scss';
import MapButtonStyles from 'styles/components/map/c-button.scss';
import CloseIcon from 'babel!svg-react!assets/icons/close.svg?name=CloseIcon';

class SearchPanel extends Component {

  onSearchInputChange(event) {
    const searchTerm = event.target.value;

    this.props.setSearchResultsVisibility(searchTerm.length > 0);

    this.props.setSearchTerm(searchTerm);
  }

  onSearchInputFocus() {
    this.props.setSearchResultsVisibility(this.props.searchTerm.length > 0);

    document.querySelector('body').style.height = `${window.innerHeight}px`;
  }

  onSearchInputBlur() {
    document.querySelector('body').style.height = '100%';
  }

  onClick() {
    if (this.props.searchTerm.length >= SEARCH_QUERY_MINIMUM_LIMIT) {
      this.props.setSearchResultsVisibility(true);
    }
  }

  cleanResults() {
    this.closeSearch();
    this.props.setSearchTerm('');
  }

  closeSearch() {
    this.props.setSearchResultsVisibility(false);
  }

  onClickMoreResults() {
    this.closeSearch();
    this.props.openSearchModal();
  }

  render() {
    let searchResults = null;

    if (this.props.searching) {
      searchResults = <li className={ResultListStyles['status-message']} >Searching...</li>;
    } else if (this.props.count && this.props.searchTerm.length >= SEARCH_QUERY_MINIMUM_LIMIT) {
      searchResults = [];
      const total = Math.min(this.props.entries.length, SEARCH_RESULTS_LIMIT);

      for (let i = 0, length = total; i < length; i++) {
        searchResults.push(<SearchResult
          className={classnames(ResultListStyles['result-item'], searchPanelStyles.result)}
          key={i}
          searchTerm={this.props.searchTerm}
          closeSearch={() => this.closeSearch()}
          vesselInfo={this.props.entries[i]}
        />);
      }
    } else if (this.props.searchTerm.length < SEARCH_QUERY_MINIMUM_LIMIT && this.props.searchTerm.length > 0) {
      searchResults = (
        <li className={ResultListStyles['status-message']} >
          Type at least {SEARCH_QUERY_MINIMUM_LIMIT} characters
        </li>);
    } else {
      searchResults = <li className={ResultListStyles['status-message']} >No result</li>;
    }

    return (
      <div className={searchPanelStyles['c-search-panel']} >
        <input
          type="text"
          onBlur={() => this.onSearchInputBlur()}
          onChange={e => this.onSearchInputChange(e)}
          onFocus={() => this.onSearchInputFocus()}
          className={searchPanelStyles['search-accordion']}
          placeholder="Search vessel"
          value={this.props.searchTerm}
          ref={ref => (this.searchField = ref)}
        />
        {this.props.searchTerm.length > 0 && <CloseIcon
          className={classnames(iconsStyles.icon, iconsStyles['icon-close'], searchPanelStyles['clean-query-button'])}
          onClick={() => this.cleanResults()}
        />}
        <div
          className={classnames(searchPanelStyles['results-container'],
            { [`${searchPanelStyles['-open']}`]: this.props.searchResultsOpen })}
        >
          <ul
            className={classnames(ResultListStyles['c-result-list'], searchPanelStyles['search-list'])}
          >
            {searchResults}
          </ul>
          {this.props.searchTerm.length >= SEARCH_QUERY_MINIMUM_LIMIT && !this.props.searching && this.props.count > SEARCH_RESULTS_LIMIT &&
          <div className={searchPanelStyles['pagination-container']} >
            <button
              className={classnames(MapButtonStyles['c-button'], MapButtonStyles['-filled'], searchPanelStyles['more-results-button'])}
              onClick={() => this.onClickMoreResults()}
            >
              more results
            </button>
          </div>}
        </div>
      </div>);
  }
}

SearchPanel.propTypes = {
  setSearchTerm: PropTypes.func,
  openSearchModal: PropTypes.func,
  setSearchResultsVisibility: PropTypes.func,
  /*
   Search results
   */
  entries: PropTypes.array,
  /*
   Number of total search results
   */
  count: PropTypes.number,
  /*
   If search is in progress
   */
  searching: PropTypes.bool,
  /*
   If search modal is open
   */
  searchModalOpen: PropTypes.bool,
  /*
   If search result is open
   */
  searchResultsOpen: PropTypes.bool,
  /*
   Search term to search for
   */
  searchTerm: PropTypes.string
};

export default SearchPanel;
