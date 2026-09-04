import { useNavigation } from 'react-router-dom';
import './NavigationProgress.css';

// A subtle top-of-viewport indicator for in-flight route loaders, so a
// navigation that takes a moment (a real network round-trip to the backend)
// doesn't read as a frozen page.
function NavigationProgress() {
    const navigation = useNavigation();
    const isLoading = navigation.state !== 'idle';

    return <div className={`nav-progress${isLoading ? ' nav-progress--active' : ''}`} aria-hidden="true" />;
}

export default NavigationProgress;
