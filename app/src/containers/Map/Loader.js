import { connect } from 'react-redux';
import Loader from 'components/Shared/Loader';

const mapStateToProps = state => ({
  visible: state.map.loading || (state.vesselInfo.infoPanelStatus && state.vesselInfo.infoPanelStatus.isLoading)
});

export default connect(mapStateToProps)(Loader);

