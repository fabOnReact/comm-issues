// @flow

import type { AppState } from '../redux-setup';
import type { ThreadInfo } from 'lib/types/thread-types';
import {
  calendarThreadFilterTypes,
  type CalendarFilter,
  calendarFilterPropType,
  type FilterThreadInfo,
  filterThreadInfoPropType,
  updateCalendarThreadFilter,
  clearCalendarThreadFilter,
} from 'lib/types/filter-types';
import type { DispatchActionPayload } from 'lib/utils/action-utils';

import * as React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import _pickBy from 'lodash/fp/pickBy';
import FontAwesomeIcon from '@fortawesome/react-fontawesome';
import faCog from '@fortawesome/fontawesome-free-solid/faCog';
import faTimesCircle from '@fortawesome/fontawesome-free-solid/faTimesCircle';
import faChevronUp from '@fortawesome/fontawesome-free-solid/faChevronUp';
import faChevronDown from '@fortawesome/fontawesome-free-solid/faChevronDown';

import { connect } from 'lib/utils/redux-utils';
import {
  filteredThreadIDsSelector,
} from 'lib/selectors/calendar-filter-selectors';
import {
  filterThreadInfos,
  filterThreadSearchIndex,
} from 'lib/selectors/calendar-selectors';
import SearchIndex from 'lib/shared/search-index';

import css from '../style.css';
import ThreadSettingsModal from '../modals/threads/thread-settings-modal.react';
import { MagnifyingGlass } from '../vectors.react';

type Props = {|
  setModal: (modal: ?React.Node) => void,
  // Redux state
  filterThreadInfos: () => $ReadOnlyArray<FilterThreadInfo>,
  filterThreadSearchIndex: () => SearchIndex,
  filteredThreadIDs: ?Set<string>,
  // Redux dispatch functions
  dispatchActionPayload: DispatchActionPayload,
|};
type State = {|
  query: string,
  searchResults: $ReadOnlyArray<FilterThreadInfo>,
  collapsed: bool,
|};
class FilterPanel extends React.PureComponent<Props, State> {

  static propTypes = {
    setModal: PropTypes.func.isRequired,
    filterThreadInfos: PropTypes.func.isRequired,
    filterThreadSearchIndex: PropTypes.func.isRequired,
    filteredThreadIDs: PropTypes.instanceOf(Set),
    dispatchActionPayload: PropTypes.func.isRequired,
  };
  state = {
    query: "",
    searchResults: [],
    collapsed: false,
  };

  currentlySelected(threadID: string): bool {
    if (!this.props.filteredThreadIDs) {
      return true;
    }
    return this.props.filteredThreadIDs.has(threadID);
  }

  render() {
    const filterThreadInfos = this.state.query
      ? this.state.searchResults
      : this.props.filterThreadInfos();

    let filters = [];
    if (!this.state.query || filterThreadInfos.length > 0) {
      filters.push(
        <Category
          numThreads={filterThreadInfos.length}
          onToggle={this.onToggleAll}
          collapsed={this.state.collapsed}
          onCollapse={this.onCollapse}
          selected={!this.props.filteredThreadIDs}
          key="all"
        />
      );
    } else {
      filters.push(
        <div className={css['calendar-filters-no-result']} key="noResults">
          No results
        </div>
      );
    }
    if (!this.state.collapsed) {
      const options = filterThreadInfos.map(
        filterThreadInfo => (
          <Item
            filterThreadInfo={filterThreadInfo}
            onToggle={this.onToggle}
            onClickOnly={this.onClickOnly}
            onClickSettings={this.onClickSettings}
            selected={this.currentlySelected(filterThreadInfo.threadInfo.id)}
            key={filterThreadInfo.threadInfo.id}
          />
        ),
      );
      filters = [...filters, ...options];
    }

    let clearQueryButton = null;
    if (this.state.query) {
      clearQueryButton = (
        <a href="#" onClick={this.clearQuery}>
          <FontAwesomeIcon
            icon={faTimesCircle}
            className={css['calendar-filters-clear-query']}
          />
        </a>
      );
    }

    return (
      <div className={css['calendar-filters-container']}>
        <div className={css['calendar-filters-search-container']}>
          <div className={css['calendar-filters-search']}>
            <MagnifyingGlass className={css['calendar-filters-search-vector']} />
            <input
              type="text"
              placeholder="Search"
              value={this.state.query}
              onChange={this.onChangeQuery}
            />
            {clearQueryButton}
          </div>
        </div>
        <div className={css['calendar-filters']}>
          {filters}
        </div>
      </div>
    );
  }

  onToggle = (threadID: string, value: bool) => {
    let newThreadIDs;
    const selectedThreadIDs = this.props.filteredThreadIDs;
    if (!selectedThreadIDs && value) {
      // No thread filter exists and thread is being added
      return;
    } else if (!selectedThreadIDs) {
      // No thread filter exists and thread is being removed
      newThreadIDs = this.props.filterThreadInfos()
        .map(filterThreadInfo => filterThreadInfo.threadInfo.id)
        .filter(id => id !== threadID);
    } else if (selectedThreadIDs.has(threadID) && value) {
      // Thread filter already includes thread being added
      return;
    } else if (selectedThreadIDs.has(threadID)) {
      // Thread being removed from current thread filter
      newThreadIDs = [...selectedThreadIDs].filter(id => id !== threadID);
    } else if (!value) {
      // Thread filter doesn't include thread being removed
      return;
    } else if (
      selectedThreadIDs.size + 1 === this.props.filterThreadInfos().length
    ) {
      // Thread filter exists and thread being added is the only one missing
      newThreadIDs = null;
    } else {
      // Thread filter exists and thread is being added
      newThreadIDs = [...selectedThreadIDs, threadID];
    }
    this.setFilterThreads(newThreadIDs);
  }

  onToggleAll = (value: bool) => {
    this.setFilterThreads(value ? null : []);
  }

  onClickOnly = (threadID: string) => {
    this.setFilterThreads([threadID]);
  }

  setFilterThreads(threadIDs: ?$ReadOnlyArray<string>) {
    if (!threadIDs) {
      this.props.dispatchActionPayload(clearCalendarThreadFilter);
    } else {
      this.props.dispatchActionPayload(
        updateCalendarThreadFilter,
        {
          type: calendarThreadFilterTypes.THREAD_LIST,
          threadIDs,
        },
      );
    }
  }

  onClickSettings = (threadInfo: ThreadInfo) => {
    this.props.setModal(
      <ThreadSettingsModal
        threadInfo={threadInfo}
        onClose={this.clearModal}
      />
    );
  }

  onChangeQuery = (event: SyntheticEvent<HTMLInputElement>) => {
    const query = event.currentTarget.value;
    const searchIndex = this.props.filterThreadSearchIndex();
    const resultIDs = new Set(searchIndex.getSearchResults(query));
    const results = this.props.filterThreadInfos().filter(
      filterThreadInfo => resultIDs.has(filterThreadInfo.threadInfo.id),
    );
    this.setState({ query, searchResults: results, collapsed: false });
  }

  clearQuery = (event: SyntheticEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    this.setState({ query: "", searchResults: [], collapsed: false });
  }

  onCollapse = (value: bool) => {
    this.setState({ collapsed: value });
  }

  clearModal = () => {
    this.props.setModal(null);
  }

}

type ItemProps = {|
  filterThreadInfo: FilterThreadInfo,
  onToggle: (threadID: string, value: bool) => void,
  onClickOnly: (threadID: string) => void,
  onClickSettings: (threadInfo: ThreadInfo) => void,
  selected: bool,
|};
class Item extends React.PureComponent<ItemProps> {

  static propTypes = {
    filterThreadInfo: filterThreadInfoPropType.isRequired,
    onToggle: PropTypes.func.isRequired,
    onClickOnly: PropTypes.func.isRequired,
    onClickSettings: PropTypes.func.isRequired,
    selected: PropTypes.bool.isRequired,
  };

  render() {
    const threadInfo = this.props.filterThreadInfo.threadInfo;
    const beforeCheckStyles = { borderColor: `#${threadInfo.color}` };
    let afterCheck = null;
    if (this.props.selected) {
      const afterCheckStyles = { backgroundColor: `#${threadInfo.color}` };
      afterCheck = (
        <div
          className={classNames(
            css['calendar-filter-option-checkbox'],
            css['calendar-filter-option-after'],
          )}
          style={afterCheckStyles}
        />
      );
    }
    const details = this.props.filterThreadInfo.numVisibleEntries === 1
      ? "1 entry"
      : `${this.props.filterThreadInfo.numVisibleEntries} entries`;
    return (
      <div className={css['calendar-filter-option']}>
        <div className={css['calendar-filter-option-thread']}>
          <input
            type="checkbox"
            checked={this.props.selected}
            onChange={this.onChange}
          />
          <label>
            <div
              className={css['calendar-filter-option-checkbox']}
              style={beforeCheckStyles}
            />
            {threadInfo.uiName}
            {afterCheck}
          </label>
          <a
            onClick={this.onClickOnly}
            className={css['calendar-filter-option-only']}
          >
            only
          </a>
          <a
            onClick={this.onClickSettings}
            className={css['calendar-filter-option-cog']}
          >
            <FontAwesomeIcon icon={faCog} />
          </a>
        </div>
        <div className={css['calendar-filter-option-details']}>
          {details}
        </div>
      </div>
    );
  }

  onChange = (event: SyntheticEvent<HTMLInputElement>) => {
    this.props.onToggle(
      this.props.filterThreadInfo.threadInfo.id,
      event.currentTarget.checked,
    );
  }

  onClickOnly = (event: SyntheticEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    this.props.onClickOnly(this.props.filterThreadInfo.threadInfo.id);
  }

  onClickSettings = (event: SyntheticEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    this.props.onClickSettings(this.props.filterThreadInfo.threadInfo);
  }

}

type CategoryProps = {|
  numThreads: number,
  onToggle: (value: bool) => void,
  collapsed: bool,
  onCollapse: (value: bool) => void,
  selected: bool,
|};
class Category extends React.PureComponent<CategoryProps> {

  static propTypes = {
    numThreads: PropTypes.number.isRequired,
    onToggle: PropTypes.func.isRequired,
    collapsed: PropTypes.bool.isRequired,
    onCollapse: PropTypes.func.isRequired,
    selected: PropTypes.bool.isRequired,
  };

  render() {
    const beforeCheckStyles = { borderColor: "white" };
    let afterCheck = null;
    if (this.props.selected) {
      const afterCheckStyles = { backgroundColor: "white" };
      afterCheck = (
        <div
          className={classNames(
            css['calendar-filter-option-checkbox'],
            css['calendar-filter-option-after'],
          )}
          style={afterCheckStyles}
        />
      );
    }
    const icon = this.props.collapsed ? faChevronUp : faChevronDown;
    const details = this.props.numThreads === 1
      ? "1 thread"
      : `${this.props.numThreads} threads`;
    return (
      <div className={css['calendar-filter-category']}>
        <div className={css['calendar-filter-option-thread']}>
          <input
            type="checkbox"
            checked={this.props.selected}
            onChange={this.onChange}
          />
          <label>
            <div
              className={css['calendar-filter-option-checkbox']}
              style={beforeCheckStyles}
            />
            Your threads
            {afterCheck}
          </label>
          <a
            onClick={this.onCollapse}
            className={css['calendar-filter-collapse']}
          >
            <FontAwesomeIcon icon={icon} />
          </a>
        </div>
        <div className={css['calendar-filter-option-details']}>
          {details}
        </div>
      </div>
    );
  }

  onChange = (event: SyntheticEvent<HTMLInputElement>) => {
    this.props.onToggle(event.currentTarget.checked);
  }

  onCollapse = (event: SyntheticEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    this.props.onCollapse(!this.props.collapsed);
  }

}

export default connect(
  (state: AppState) => ({
    filteredThreadIDs: filteredThreadIDsSelector(state),
    filterThreadInfos: filterThreadInfos(state),
    filterThreadSearchIndex: filterThreadSearchIndex(state),
  }),
  null,
  true,
)(FilterPanel);
