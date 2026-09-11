module.exports = {
    init: function(api) {
        api.registerPattern({
            name: 'docker-daemon-not-running',
            match: /Cannot connect to the Docker daemon/i,
            heal: function(errorMessage, api) {
                return {
                    action: 'run_command',
                    command: 'sudo systemctl start docker',
                    explanation: 'The Docker daemon is not running. Starting the docker service.'
                };
            }
        });

        api.registerPattern({
            name: 'docker-port-allocated',
            match: /Bind for .* failed: port is already allocated/i,
            heal: function(errorMessage, api) {
                return {
                    action: 'inform',
                    explanation: 'A Docker container is trying to bind to a port that is already in use by another process. Please stop the conflicting process or change the container port mapping.'
                };
            }
        });
    }
};
