import { connect } from 'react-redux';
import SupportForm from 'components/Map/SupportForm';
import { submitForm } from 'actions/contact';
import { setSupportModalVisibility } from 'actions/map';

const mapStateToProps = state => ({
  visibility: state.map.supportModal.open,
  contactStatus: state.contactStatus,
  defaultUserName: state.user.loggedUser ? state.user.loggedUser.displayName : '',
  defaultUserEmail: state.user.loggedUser ? state.user.loggedUser.email : ''
});

const mapDispatchToProps = dispatch => ({
  onFormSubmit: (data, endpoint) => dispatch(submitForm(data, endpoint)),
  close: () => dispatch(setSupportModalVisibility(false))
});

export default connect(mapStateToProps, mapDispatchToProps)(SupportForm);
