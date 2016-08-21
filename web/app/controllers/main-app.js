app.controller('main-app', function($scope, $timeout, $http, $q) {
    $scope.initialised = false;
    $scope.logins = {};
    $scope.googleProfiles = [], $scope.fbPages = [];

    // Runs on page load
    function init() {
        var deferred = $q.defer();
        var initTasks = [];

        initTasks.push(checkLogins());
        $q.all(initTasks).then(function() {
            $scope.initialised = true;
        })
    }

    function navigate(link) {
        window.location.href = link;
    };

    // Checks all of the authentication for the different integrations
    function checkLogins() {
        var urlCalls = [];
        var deferred = $q.defer();

        // Check Google Analytics auth by attempting to retrieve profiles
        var ga = $http.get('/google/analytics/profiles').then(function(response) {
            $scope.logins.ga = true;
            $scope.googleProfiles = response.data;
            if ($scope.googleProfiles.length > 0)
                $scope.googleProfile = $scope.googleProfiles[0].id;
        }, function(err) {
            console.log(err.data.error);
            if (err.data.hasOwnProperty('authUrl'))
                $scope.logins.ga = false;
        });
        urlCalls.push(ga);

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
        console.log($scope.fbPage, $scope.fbPages);
    }

    // Google Analytics endpoints
    $scope.gaLogin = function() {
        $http.get('/auth/google').then(function(response) {
            navigate(response.data);
        }, googleError);
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
