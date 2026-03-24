// TODO(browser): Replace with browser-native implementation
/**
 * Node.js events module re-export.
 * Pure JS — works in any environment.
 */
import events, { EventEmitter } from 'events';

export { EventEmitter, once, on, getEventListeners, setMaxListeners, listenerCount } from 'events';
export default EventEmitter; // Node convention: require('events') === EventEmitter
