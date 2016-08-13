app.controller('main-app', function($scope, $timeout, $http) {
    $scope.googleProfiles = [], $scope.fbPages = [];

    function navigate(link) {
        window.location.href = link;
    };

    // If the failure is due to lack of access, redirect to login page
    function googleError(err) {
        console.log(err.data);
        if (err.data.hasOwnProperty('authUrl')) {
            navigate(err.data.authUrl);
        }
    }

    // If the failure is due to lack of access, redirect to login page
    function fbError(err) {
        console.log(err.data);
        if (err.data.hasOwnProperty('authUrl')) {
            $scope.fbLogin();
        }
    }

    $scope.googleQuery = function() {
        $http.get('/google/analytics').then(function(response) {
            $scope.gaSessions = response.data[0];
        }, googleError);
    };

    $scope.getGoogleProfiles = function() {
        $http.get('/google/analytics/profiles').then(function(response) {
            $scope.googleProfiles = response.data;
        }, googleError);
    };

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

    $scope.getFBPages = function() {
        $http.get('/facebook/analytics/pages').then(function(response) {
            console.log(response.data);
            $scope.fbPages = response.data;
        }, fbError);
    }
});
