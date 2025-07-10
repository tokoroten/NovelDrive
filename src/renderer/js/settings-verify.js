// Settings verification script
// This script helps verify that settings functionality is working properly

console.log('=== Settings Verification Script ===');

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined' && !window.api;
console.log(`Environment: ${isBrowser ? 'Browser' : 'Electron'}`);

// Check localStorage availability
try {
    localStorage.setItem('test-key', 'test-value');
    const value = localStorage.getItem('test-key');
    localStorage.removeItem('test-key');
    console.log('✓ localStorage is available');
} catch (error) {
    console.error('✗ localStorage error:', error);
}

// Check Mock API availability
if (window.mockAPI) {
    console.log('✓ Mock API is available');
    
    // Test settings retrieval
    window.mockAPI.invoke('settings:get').then(settings => {
        console.log('✓ Settings retrieved:', settings);
    }).catch(error => {
        console.error('✗ Settings retrieval error:', error);
    });
    
    // Test OpenAI config
    window.mockAPI.invoke('openai:getConfig').then(config => {
        console.log('✓ OpenAI config retrieved:', config);
    }).catch(error => {
        console.error('✗ OpenAI config error:', error);
    });
} else {
    console.warn('⚠ Mock API not available');
}

// Check for saved API key in localStorage
const savedApiKey = localStorage.getItem('novel-drive-openai-key');
if (savedApiKey) {
    console.log('✓ Found saved API key in localStorage');
} else {
    console.log('ℹ No saved API key found in localStorage');
}

// Check for saved settings in localStorage
const savedSettings = localStorage.getItem('novel-drive-settings');
if (savedSettings) {
    try {
        const settings = JSON.parse(savedSettings);
        console.log('✓ Found saved settings in localStorage:', settings);
    } catch (error) {
        console.error('✗ Error parsing saved settings:', error);
    }
} else {
    console.log('ℹ No saved settings found in localStorage');
}

// Export verification function for external use
window.verifySettings = function() {
    console.log('\n=== Running Settings Verification ===');
    
    const results = {
        environment: isBrowser ? 'browser' : 'electron',
        localStorage: false,
        mockAPI: false,
        savedApiKey: false,
        savedSettings: false
    };
    
    // Test localStorage
    try {
        localStorage.setItem('verify-test', 'ok');
        localStorage.removeItem('verify-test');
        results.localStorage = true;
    } catch (error) {
        console.error('localStorage test failed:', error);
    }
    
    // Test Mock API
    results.mockAPI = !!window.mockAPI;
    
    // Check saved data
    results.savedApiKey = !!localStorage.getItem('novel-drive-openai-key');
    results.savedSettings = !!localStorage.getItem('novel-drive-settings');
    
    console.log('Verification results:', results);
    return results;
};

console.log('\nTo run verification again, call: window.verifySettings()');