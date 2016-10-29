app.controller('main-app', function($scope, $timeout, $http, $q, $mdDialog, Global, Dialogues) {
    $scope.initialised = false;
    $scope.mode = 'datasets';
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
        $scope.loading = true;
        Global.fetchConnections($scope.conns, function() {
            Global.fetchDatasets(function(datasets) {
                $scope.initialised = true;
                $scope.loading = false;
                $scope.datasets = datasets;
            })
        })
    }

    function navigate(link) {
        window.location.href = link;
    };

    $scope.test = function() {
        console.log($scope.conns);
    }

    // Shows dialogue with all possible connections
    $scope.showConnections = function(ev) {
        Dialogues.showConnections(ev, $scope.conns);
    }

    // Manage the datasets via a dialogue
    $scope.manageDatasets = function(ev) {
        // Dialogues.manageDatasets(ev, $scope.datasets, $scope.conns);
        $scope.mode = $scope.mode == 'datasets' ? 'none' : 'datasets';
    }

    // Log off from the application
    $scope.logout = function() {
        navigate('/auth/local/logoff');
    }

    init();
});
