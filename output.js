// Functions to output the current state.
// For functions to render the state _after_ the tests have finished, look in render.js .
const assert = require('assert');
const readline = require('readline');

const utils = require('./utils');

const STATUS_STREAM = process.stderr;

var last_state;

function clean(config) {
    assert(config);
    if (!STATUS_STREAM.isTTY) return;
    if (config.no_clear_line) return;
    readline.cursorTo(STATUS_STREAM, 0);
    readline.clearLine(STATUS_STREAM, 0);
}

function status(config, state) {
    if (config.quiet) return;
    assert(state.tasks);

    last_state = state;

    const {tasks} = state;
    const running = tasks.filter(s => s.status === 'running');
    const running_count = running.length;
    const done_count = utils.count(tasks, t => (t.status === 'success') || (t.status === 'error'));
    const failed_count = utils.count(tasks, t => t.status === 'error');
    const skipped_count = utils.count(tasks, t => t.status === 'skipped');
    const failed_str = failed_count > 0 ? `${failed_count} failed, ` : '';

    // Fit output into one line
    // Instead of listing all running tests  (aaa bbb ccc), we write (aaa  +2).
    const terminal_width = STATUS_STREAM.getWindowSize ? STATUS_STREAM.getWindowSize()[0] : Infinity;
    let status_str;
    for (let running_show = running.length;running_show >= 0;running_show--) {
        const running_str = (
            running.slice(0, running_show).map(({tc}) => tc.name).join(' ')
            + (running_show < running.length ? '  +' + (running.length - running_show) : '')
        );
        status_str = (
            `${done_count}/${tasks.length - skipped_count} done, ` +
            `${failed_str}${running_count} running (${running_str})`);

        if (status_str.length < terminal_width) {
            break; // Fits!
        }
    }

    clean(config);
    STATUS_STREAM.write(status_str);
    if (!STATUS_STREAM.isTTY || config.no_clear_line) {
        STATUS_STREAM.write('\n');
    }
}


function finish(config, state) {
    last_state = null;
    const {tasks} = state;
    assert(tasks);

    clean(config);

    const success_count = utils.count(tasks, t => t.status === 'success');
    const error_count = utils.count(tasks, t => t.status === 'error');
    const skipped = tasks.filter(t => t.status === 'skipped');
    const expectedToFail = tasks.filter(t => t.expectedToFail);
    if (tasks.length === 0 && config.filter) {
        STATUS_STREAM.write(`No test case found with filter: ${config.filter}\n`);
    }
    STATUS_STREAM.write(`${success_count} tests passed, ${error_count} tests failed.\n`);
    if (skipped.length > 0) {
        STATUS_STREAM.write(`Skipped ${skipped.length} tests (${skipped.map(s => s.name).join(' ')})\n`);
    }
    if (!config.expect_nothing && (expectedToFail.length > 0)) {
        STATUS_STREAM.write(`${expectedToFail.length} tests failed as expected (${expectedToFail.map(s => s.name).join(' ')}). Pass in -E/--expect-nothing to ignore expectedToFail declarations.\n`);
    }

    // Internal self-check
    const normal_count = skipped.length + success_count + error_count;
    if (normal_count !== tasks.length) {
        const inconsistent = tasks.filter(t => !['success', 'error', 'skipped'].includes(t.status));
        if (inconsistent.length === 0) {
            STATUS_STREAM.write(
                `INTERNAL ERROR: ${normal_count} out of ${tasks.length} tasks are normal, but` +
                ` ${inconsistent.length} are in a strange state.`);
        } else {
            STATUS_STREAM.write(
                `INTERNAL ERROR: ${inconsistent.length} out of ${tasks.length} tasks` +
                ` are in an inconsistent state. First affected task is ${inconsistent[0].name}` +
                ` in state ${inconsistent[0].status}.`);
        }
    }
}

function log(config, message) {
    if (config.logFunc) return config.logFunc(config, message);

    if (! config.concurrency) {
        console.log(message);  // eslint-disable-line no-console
        return;
    }

    if (last_state) {
        clean(config);
    }
    console.log(message); // eslint-disable-line no-console
    if (last_state) {
        status(config, last_state);
    }
}

function logVerbose(config, message) {
    if (!config.verbose) return;
    log(config, message);
}

module.exports = {
    finish,
    log,
    logVerbose,
    status,
};
