app.controller('main-app', function($scope, $timeout, $http, $q, $mdDialog, Global) {
    $scope.initialised = false;
    $scope.logins = {};
    $scope.fbPages = [];
    $scope.conns = {
        google: {},
        facebook: {}
    };

    // Runs on page load
    function init() {
        Global.fetchConnections($scope.conns, function() {
            $scope.initialised = true;
        }, function() {
            console.log('Failed to retrieve connections');
        })
    }

    function navigate(link) {
        window.location.href = link;
    };

    // Checks all of the authentication for the different integrations
    function checkLogins() {
        var urlCalls = [];
        var deferred = $q.defer();

        // Check Facebook auth by attempting to retrieve pages
        var fb = $http.get('/facebook/analytics/pages').then(function(response) {
            $scope.logins.fb = true;
            $scope.fbPages = response.data;
            if ($scope.fbPages.length > 0)
                $scope.fbPage = $scope.fbPages[0].id;
        }, function(err) {
            console.log(err.data.error);
            if (err.data.hasOwnProperty('authUrl'))
                $scope.logins.fb = false;
        });
        urlCalls.push(fb);

        $q.all(urlCalls).then(function() {
            deferred.resolve();
        });

        return deferred.promise;
    }

    $scope.test = function() {
        console.log($scope.conns);
    }

    // Shows dialogue with all possible connections
    $scope.showConnections = function(ev) {
        $mdDialog.show({
            controller: DialogueController,
            templateUrl: '/app/templates/dialogues/connections.html',
            parent: angular.element(document.body),
            targetEvent: ev,
            locals: {
                conns: $scope.conns
            }
        })
        .then(function(connections) {
            $scope.conns = connections;
        });
    }

    // Log off from the application
    $scope.logout = function() {
        navigate('/auth/local/logoff');
    }

    $scope.gaQuery = function() {
        $http.get('/google/analytics').then(function(response) {
            $scope.gaSessions = response.data[0];
        }, googleError);
    };

    // If the failure is due to lack of access, redirect to login page
    function googleError(err) {
        console.log(err.data);
        if (err.data.hasOwnProperty('authUrl')) { // Authenticate if necessary
            navigate(err.data.authUrl);
        }
    }

    // Facebook Insights endpoints
    $scope.fbLogin = function() {
        $http.get('/auth/facebook').then(function(response) {
            navigate(response.data);
        }, fbError);
    };

    $scope.fbQuery = function() {
        $http.get('/facebook/analytics').then(function(response) {
            console.log(response.data);
        }, fbError);
    };

    // If the failure is due to lack of access, redirect to login page
    function fbError(err) {
        console.log(err.data);
        if (err.data.hasOwnProperty('authUrl')) { // Authenticate if necessary
            $scope.fbLogin();
        }
    }

    // Angular dialog controller
    function DialogueController($scope, $mdDialog, conns) {
        $scope.conns = conns;
        $scope.close = function() {
            $scope.loading = true;
            $http.post('/settings/connections', $scope.conns).then(function() {
                $scope.loading = false;
                $mdDialog.hide($scope.conns);
            }, function() {
                $scope.loading = false;
                $mdDialog.hide($scope.conns);
            });

        };
    }

    init();
});
