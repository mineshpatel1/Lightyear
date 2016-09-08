app.factory('Dialogues', ['$http', '$q', '$mdDialog', 'Global', function($http, $q, $mdDialog, Global) {

    // Connections dialogue controller
    function connections($scope, $mdDialog, conns) {
        $scope.connections = conns;

        $scope.logins = {};
        $scope.loading = false, $scope.initialised = false;

        // Google authorisation functions
        $scope.gaLogin = function() {
            $http.post('/auth/google').then(function(response) {
                window.location.href = response.data;
            }, genError);
        }

        $scope.gaRevoke = function() {
            $scope.loading = true;
            $http.delete('/auth/google').then(function(response) {
                $scope.loading = false;
                $scope.connections.google = {};
            }, genError);
        }

        // Facebook authorisation functions
        $scope.fbLogin = function() {
            $http.post('/auth/facebook').then(function(response) {
                window.location.href = response.data;
            }, genError);
        }

        $scope.fbRevoke = function() {
            $scope.loading = true;
            $http.delete('/auth/facebook').then(function(response) {
                $scope.loading = false;
                $scope.connections.facebook = {};
            }, genError);
        }

        // Twitter authorisation functions
        $scope.twitterLogin = function() {
            $http.post('/auth/twitter').then(function(response) {
                window.location.href = response.data;
            }, genError);
        }

        $scope.twitterRevoke = function() {
            $http.delete('/auth/twitter').then(function(response) {
                $scope.loading = false;
                $scope.connections.twitter = {};
            }, genError);
        }

        // Configure Database
        $scope.dbConfig = function(ev) {
            var saveEvent = ev; // Ensure the event is still in context
            showDBConfig(saveEvent, $scope.connections.postgre, function(db) {
                $scope.connections.postgre = db;
                // Chain the connections window after the DB window is closed
                showConnections(saveEvent, $scope.connections);
            });
        }

        $scope.dbClear = function() {
            $scope.loading = true;
            $http.delete('/postgre/user').then(function(response) {
                $scope.loading = false;
                $scope.connections.postgre = {};
            }, genError);
        }

        function genError() {
            $scope.loading = false;
        }

        // Check all of the authentication adn retrieve the necessary user data
        function init() {
            $scope.loading = true;
            Global.fetchConnections($scope.connections, function() {
                $scope.initialised = true;
                $scope.loading = false;
            })
        }

        init();

        $scope.close = function() {
            $scope.loading = true;
            $http.post('/settings/connections', $scope.connections).then(function() {
                $scope.loading = false;
                $mdDialog.hide($scope.connections);
            }, function() {
                $scope.loading = false;
                $mdDialog.hide($scope.connections);
            });
        };
    }

    // Show the connections modal
    var showConnections = function(ev, conns) {
		$mdDialog.show({
            controller: connections,
            templateUrl: '/app/templates/dialogues/connections.html',
            parent: angular.element(document.body),
            targetEvent: ev,
            locals: {
                conns: conns
            }
        }).then(function(connections) {
            conns = connections;
        });
	}

    // PostgreSQL diagolue controller
    function dbConfig($scope, $mdDialog, db) {
        $scope.original = angular.copy(db);
        $scope.db = db;

        $scope.close = function() {
            $scope.loading = true;
            $http.post('/postgre/user', $scope.db).then(function(response) {
                $scope.db = response.data;
                $mdDialog.hide($scope.db);
            }, function(response) {
                console.log(response.data);
                switch (response.data.code) {
                    case 'EHOSTUNREACH':
                        $scope.error = 'Hostname is unreachable.';
                        break;
                    case 'ENOTFOUND':
                        $scope.error = 'Hostname/Database not found.';
                        break;
                    case 'ETIMEDOUT':
                        $scope.error = 'Connection timed out.';
                        break;
                    default:
                        $scope.error = 'Could not connect to the database.';
                        break;
                }
                $scope.loading = false;
            });
        };

        $scope.cancel = function() {
            $mdDialog.hide($scope.original);
        }
    }

    var showDBConfig = function(ev, inpDB, callback) {
        $mdDialog.show({
            controller: dbConfig,
            templateUrl: '/app/templates/dialogues/configureDB.html',
            parent: angular.element(document.body),
            targetEvent: ev,
            locals: {
                db : inpDB,
                callback : callback
            }
        }).then(function(db) {
            if (callback) {
                callback(db);
            }
        });
    }

    var Dialogues = {
        showConnections : showConnections,
        configDB : showDBConfig
    }
    return Dialogues;
}]);
