app.controller('main-app', function($scope, $timeout, $http, $q, $mdDialog, Global, Dialogues) {
    $scope.initialised = false;
    $scope.logins = {};
    $scope.fbPages = [];
    $scope.conns = {
        google: {},
        facebook: {},
        twitter: {},
        postgre: {}
    };

    $scope.datasets = [];

    // Runs on page load
    function init() {
        Global.fetchConnections($scope.conns, function() {
            Global.fetchDatasets(function(datasets) {
                $scope.initialised = true;
                $scope.datasets = datasets;
            })
        })
    }

    function navigate(link) {
        window.location.href = link;
    };

    $scope.test = function() {
        $http.post('/postgre/query', { query : "select * from f_twitter_daily" }).then(function(response) {
            console.log(response);
        }, function(response) {
            console.log(response);
        });
    }

    // Shows dialogue with all possible connections
    $scope.showConnections = function(ev) {
        Dialogues.showConnections(ev, $scope.conns);
    }

    // Manage the datasets via a dialogue
    $scope.manageDatasets = function(ev) {
        Dialogues.manageDatasets(ev, $scope.datasets, $scope.conns);
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

    init();
});
