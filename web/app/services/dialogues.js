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
                        $scope.error = 'Hostname or database not found.';
                        break;
                    case 'ETIMEDOUT':
                        $scope.error = 'Connection timed out.';
                        break;
                    case '28P01':
                        $scope.error = 'Incorrect username or password.';
                        break;
                    case '3D000':
                        $scope.error = 'Database does not exist.'
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

    // Show the database configuration modal
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

    function manageDatasets($scope, $mdDialog, datasets, conns) {
        $scope.datasets = datasets;
        $scope.conns = conns;

        $scope.addDataset = function(ev) {
            Dialogues.editDataset(ev, false, $scope.conns, function(dataset) {
                if (dataset)
                    $scope.datasets.push(dataset);
                Dialogues.manageDatasets(ev, $scope.datasets, $scope.conns);
            });
        }

        // Opens the dataset for editing
        $scope.editDataset = function(ev, dataset, i) {
            var idx = i;
            Dialogues.editDataset(ev, dataset, $scope.conns, function(dataset) {
                $scope.datasets[idx] = dataset;
                Dialogues.manageDatasets(ev, $scope.datasets, $scope.conns);
            });
        }

        // Removes the dataset from the array
        $scope.removeDataset = function(i) {
            $scope.datasets.splice(i, 1);
        }

        $scope.close = function() {
            $http.post('/datasets', $scope.datasets.map(function(ds) {
                return ds.noData();
            }));
            $mdDialog.hide($scope.datasets);
        }
    }

    var showDataManager = function(ev, inpDS, conns, callback) {
        $mdDialog.show({
            controller: manageDatasets,
            templateUrl: '/app/templates/dialogues/manageDatasets.html',
            parent: angular.element(document.body),
            targetEvent: ev,
            locals: {
                datasets : inpDS,
                conns: conns,
                callback : callback
            }
        }).then(function(datasets) {
            if (callback) {
                callback(datasets);
            }
        });
    }

    function editDataset($scope, $mdDialog, dataset, conns) {
        if (!dataset) {
            $scope.new = true;
            dataset = new sma.Dataset(conns);
        }
        $scope.original = angular.copy(dataset);
        $scope.dataset = dataset;
        $scope.connections = conns;
        $scope.connectors = sma.Connectors;

        $scope.preview = function() {
            $scope.loading = true;
            $http.post('/query', $scope.dataset).then(function(response) {
                $scope.loading = false;
                $scope.dataset.Data = response.data.rows;
                console.log(response.data);

            }, function(response) {
                $scope.loading = false;
                console.log(response.data);
            });
        }

        $scope.close = function() {
            if ($scope.dataset.Name && $scope.dataset.Type) {
                $mdDialog.hide($scope.dataset);
            }
        }

        $scope.cancel = function() {
            if ($scope.new) { // Don't pass anything back if cancelling a new query
                $mdDialog.hide();
            } else {
                $mdDialog.hide($scope.original);
            }
        }
    }

    var showDatasetEdit = function(ev, inpDS, conns, callback) {
        $mdDialog.show({
            controller: editDataset,
            templateUrl: '/app/templates/dialogues/editDataset.html',
            parent: angular.element(document.body),
            targetEvent: ev,
            locals: {
                dataset : inpDS,
                conns : conns,
                callback : callback
            }
        }).then(function(dataset) {
            if (callback) {
                callback(dataset);
            }
        });
    }

    var Dialogues = {
        showConnections : showConnections,
        configDB : showDBConfig,
        manageDatasets : showDataManager,
        editDataset : showDatasetEdit
    }
    return Dialogues;
}]);
