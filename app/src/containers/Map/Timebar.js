import { connect } from 'react-redux';
import Timebar from 'components/Map/Timebar';
import {
  setInnerTimelineDates,
  setOuterTimelineDates,
  setPlayingStatus,
  setTimelineHoverDates,
  rewindTimeline
} from 'actions/filters';

const mapStateToProps = state => ({
  timebarChartData: state.timebar.chartData,
  timelineOverallExtent: state.filters.timelineOverallExtent,
  timelineOuterExtent: state.filters.timelineOuterExtent,
  timelineInnerExtent: state.filters.timelineInnerExtent,
  timelinePaused: state.filters.timelinePaused
});

const mapDispatchToProps = dispatch => ({
  updateInnerTimelineDates: (dates) => {
    dispatch(setInnerTimelineDates(dates));
  },
  updateOuterTimelineDates: (dates, startChanged) => {
    dispatch(setOuterTimelineDates(dates, startChanged));
  },
  updatePlayingStatus: (paused) => {
    dispatch(setPlayingStatus(paused));
  },
  updateTimelineOverDates: (dates) => {
    dispatch(setTimelineHoverDates(dates));
  },
  rewind: () => {
    dispatch(rewindTimeline());
  }
});

export default connect(mapStateToProps, mapDispatchToProps)(Timebar);
