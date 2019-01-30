// @flow

import type { LoadingStatus } from 'lib/types/loading-types';
import { type AppState, type NavInfo, navInfoPropType } from './redux-setup';
import type { DispatchActionPayload } from 'lib/utils/action-utils';
import { type VerifyField, verifyField } from 'lib/types/verify-types';

import * as React from 'react';
import invariant from 'invariant';
import _isEqual from 'lodash/fp/isEqual';
import PropTypes from 'prop-types';
import Visibility from 'visibilityjs';
import FontAwesomeIcon from '@fortawesome/react-fontawesome';
import faCalendar from '@fortawesome/fontawesome-free-solid/faCalendar';
import faChat from '@fortawesome/fontawesome-free-solid/faComments';
import classNames from 'classnames';
import fontawesome from '@fortawesome/fontawesome';

import { getDate } from 'lib/utils/date-utils';
import {
  fetchEntriesActionTypes,
  updateCalendarQueryActionTypes,
} from 'lib/actions/entry-actions';
import {
  createLoadingStatusSelector,
  combineLoadingStatuses,
} from 'lib/selectors/loading-selectors';
import { connect } from 'lib/utils/redux-utils';
import { registerConfig } from 'lib/utils/config';
import {
  mostRecentReadThreadSelector,
  unreadCount,
} from 'lib/selectors/thread-selectors';
import {
  backgroundActionType,
  foregroundActionType,
} from 'lib/reducers/foreground-reducer';

import { activeThreadSelector } from './selectors/nav-selectors';
import { canonicalURLFromReduxState, navInfoFromURL } from './url-utils';
import css from './style.css';
import AccountBar from './account-bar.react';
import Calendar from './calendar/calendar.react';
import ResetPasswordModal from './modals/account/reset-password-modal.react';
import VerificationSuccessModal
  from './modals/account/verification-success-modal.react';
import LoadingIndicator from './loading-indicator.react';
import history from './router-history';
import { updateNavInfoActionType } from './redux-setup';
import Splash from './splash/splash.react';
import Chat from './chat/chat.react';

// We want Webpack's css-loader and style-loader to handle the Fontawesome CSS,
// so we disable the autoAddCss logic and import the CSS file.
fontawesome.config = { autoAddCss: false };
import '@fortawesome/fontawesome/styles.css';

registerConfig({
  // We can't securely cache credentials on web, so we have no way to recover
  // from a cookie invalidation
  resolveInvalidatedCookie: null,
  // We use httponly cookies on web to protect against XSS attacks, so we have
  // no access to the cookies from JavaScript
  setCookieOnRequest: false,
  setSessionIDOnRequest: true,
  // Never reset the calendar range
  calendarRangeInactivityLimit: null,
  platformDetails: { platform: "web" },
});

type Props = {
  location: {
    pathname: string,
  },
  // Redux state
  navInfo: NavInfo,
  verifyField: ?VerifyField,
  entriesLoadingStatus: LoadingStatus,
  loggedIn: bool,
  mostRecentReadThread: ?string,
  activeThreadCurrentlyUnread: bool,
  viewerID: ?string,
  unreadCount: number,
  // Redux dispatch functions
  dispatchActionPayload: DispatchActionPayload,
};
type State = {|
  currentModal: ?React.Node,
|};
class App extends React.PureComponent<Props, State> {

  static propTypes = {
    location: PropTypes.shape({
      pathname: PropTypes.string.isRequired,
    }).isRequired,
    navInfo: navInfoPropType.isRequired,
    verifyField: PropTypes.number,
    entriesLoadingStatus: PropTypes.string.isRequired,
    loggedIn: PropTypes.bool.isRequired,
    mostRecentReadThread: PropTypes.string,
    activeThreadCurrentlyUnread: PropTypes.bool.isRequired,
    viewerID: PropTypes.string,
    unreadCount: PropTypes.number.isRequired,
    dispatchActionPayload: PropTypes.func.isRequired,
  };
  state = {
    currentModal: null,
  };

  componentDidMount() {
    if (this.props.navInfo.verify) {
      if (this.props.verifyField === verifyField.RESET_PASSWORD) {
        this.showResetPasswordModal();
      } else if (this.props.verifyField === verifyField.EMAIL) {
        const newURL = canonicalURLFromReduxState(
          {
            ...this.props.navInfo,
            verify: null,
          },
          this.props.location.pathname,
        );
        history.replace(newURL);
        this.setModal(
          <VerificationSuccessModal onClose={this.clearModal} />
        );
      }
    }

    if (this.props.loggedIn) {
      const newURL = canonicalURLFromReduxState(
        this.props.navInfo,
        this.props.location.pathname,
      );
      if (this.props.location.pathname !== newURL) {
        history.replace(newURL);
      }
    } else if (this.props.location.pathname !== '/') {
      history.replace('/');
    }

    Visibility.change(this.onVisibilityChange);
  }

  onVisibilityChange = (e, state: string) => {
    if (state === "visible") {
      this.props.dispatchActionPayload(foregroundActionType, null);
    } else {
      this.props.dispatchActionPayload(backgroundActionType, null);
    }
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.verifyField === verifyField.RESET_PASSWORD) {
      if (prevProps.navInfo.verify && !this.props.navInfo.verify) {
        this.clearModal();
      } else if (!prevProps.navInfo.verify && this.props.navInfo.verify) {
        this.showResetPasswordModal();
      }
    }
  }

  showResetPasswordModal() {
    const newURL = canonicalURLFromReduxState(
      {
        ...this.props.navInfo,
        verify: null,
      },
      this.props.location.pathname,
    );
    const onClose = () => history.push(newURL);
    const onSuccess = () => history.replace(newURL);
    this.setModal(
      <ResetPasswordModal onClose={onClose} onSuccess={onSuccess} />
    );
  }

  componentWillReceiveProps(nextProps: Props) {
    if (nextProps.loggedIn) {
      if (nextProps.location.pathname !== this.props.location.pathname) {
        const newNavInfo = navInfoFromURL(
          nextProps.location.pathname,
          nextProps.navInfo,
        );
        if (!_isEqual(newNavInfo)(nextProps.navInfo)) {
          this.props.dispatchActionPayload(updateNavInfoActionType, newNavInfo);
        }
      } else if (!_isEqual(nextProps.navInfo)(this.props.navInfo)) {
        const newURL = canonicalURLFromReduxState(
          nextProps.navInfo,
          nextProps.location.pathname,
        );
        if (newURL !== nextProps.location.pathname) {
          history.push(newURL);
        }
      }
    }

    const justLoggedIn = nextProps.loggedIn && !this.props.loggedIn;
    if (justLoggedIn) {
      const newURL = canonicalURLFromReduxState(
        nextProps.navInfo,
        nextProps.location.pathname,
      );
      if (nextProps.location.pathname !== newURL) {
        history.replace(newURL);
      }
    }

    const justLoggedOut = !nextProps.loggedIn && this.props.loggedIn;
    if (justLoggedOut && nextProps.location.pathname !== '/') {
      history.replace('/');
    }
  }

  render() {
    let content;
    if (this.props.loggedIn) {
      content = this.renderMainContent();
    } else {
      content = (
        <Splash
          setModal={this.setModal}
          currentModal={this.state.currentModal}
        />
      );
    }
    return (
      <React.Fragment>
        {content}
        {this.state.currentModal}
      </React.Fragment>
    );
  }

  renderMainContent() {
    const calendarNavClasses = classNames({
      [css['current-tab']]: this.props.navInfo.tab === "calendar",
    });
    const chatNavClasses = classNames({
      [css['current-tab']]: this.props.navInfo.tab === "chat",
    });

    let mainContent;
    if (this.props.navInfo.tab === "calendar") {
      mainContent = (
        <Calendar
          setModal={this.setModal}
          url={this.props.location.pathname}
        />
      );
    } else if (this.props.navInfo.tab === "chat") {
      mainContent = (
        <Chat setModal={this.setModal} />
      );
    }

    const { viewerID, unreadCount } = this.props;
    invariant(viewerID, "should be set");
    let chatBadge = null;
    if (unreadCount > 0) {
      chatBadge = (
        <div className={css.chatBadge}>
          {unreadCount}
        </div>
      );
    }

    return (
      <React.Fragment>
        <header className={css['header']}>
          <div className={css['main-header']}>
            <h1>SquadCal</h1>
            <ul className={css['nav-bar']}>
              <li className={calendarNavClasses}>
                <div><a onClick={this.onClickCalendar}>
                  <FontAwesomeIcon
                    icon={faCalendar}
                    className={css['nav-bar-icon']}
                  />
                  Calendar
                </a></div>
              </li>
              <li className={chatNavClasses}>
                <div><a onClick={this.onClickChat}>
                  <FontAwesomeIcon
                    icon={faChat}
                    className={css['nav-bar-icon']}
                  />
                  Chat
                  {chatBadge}
                </a></div>
              </li>
            </ul>
            <div className={css['upper-right']}>
              <LoadingIndicator
                status={this.props.entriesLoadingStatus}
                size="medium"
                loadingClassName={css['page-loading']}
                errorClassName={css['page-error']}
              />
              <AccountBar setModal={this.setModal} />
            </div>
          </div>
        </header>
        <div className={css['main-content-container']}>
          <div className={css['main-content']}>
            {mainContent}
          </div>
        </div>
      </React.Fragment>
    );
  }

  setModal = (modal: ?React.Node) => {
    this.setState({ currentModal: modal });
  }

  clearModal = () => {
    this.setModal(null);
  }

  onClickCalendar = (event: SyntheticEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    this.props.dispatchActionPayload(
      updateNavInfoActionType,
      {
        ...this.props.navInfo,
        tab: "calendar",
      },
    );
  }

  onClickChat = (event: SyntheticEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    this.props.dispatchActionPayload(
      updateNavInfoActionType,
      {
        ...this.props.navInfo,
        tab: "chat",
        activeChatThreadID: this.props.activeThreadCurrentlyUnread
          ? this.props.mostRecentReadThread
          : this.props.navInfo.activeChatThreadID,
      },
    );
  }

}

const fetchEntriesLoadingStatusSelector
  = createLoadingStatusSelector(fetchEntriesActionTypes);
const updateCalendarQueryLoadingStatusSelector
  = createLoadingStatusSelector(updateCalendarQueryActionTypes);

export default connect(
  (state: AppState) => {
    const activeChatThreadID = state.navInfo.activeChatThreadID;
    return {
      navInfo: state.navInfo,
      verifyField: state.verifyField,
      entriesLoadingStatus: combineLoadingStatuses(
        fetchEntriesLoadingStatusSelector(state),
        updateCalendarQueryLoadingStatusSelector(state),
      ),
      loggedIn: !!(state.currentUserInfo &&
        !state.currentUserInfo.anonymous && true),
      mostRecentReadThread: mostRecentReadThreadSelector(state),
      activeThreadCurrentlyUnread: !activeChatThreadID ||
        state.threadStore.threadInfos[activeChatThreadID].currentUser.unread,
      viewerID: state.currentUserInfo && state.currentUserInfo.id,
      unreadCount: unreadCount(state),
    };
  },
  null,
  true,
)(App);
