app.controller('main-app', function($scope, $timeout, $http) {
    function navigate(link) {
        window.location.href = link;
    };

    $scope.googleQuery = function() {
        $http.get('/google/analytics').then(function(response) {
            $scope.gaSessions = response.data[0];
        }, function(err) {
            console.log(err.data);

            // If the failure is due to lack of access, redirect to login page
            if (err.data.hasOwnProperty('authUrl')) {
                navigate(err.data.authUrl);
            }
        });
    };

    $scope.fbLogin = function() {
        $http.get('/auth/facebook').then(function(response) {
            navigate(response.data);
        }, function(err) {
            console.log(err);
        });
    };

    $scope.fbQuery = function() {
        $http.get('/facebook/analytics').then(function(response) {
            console.log(response.data);
        }, function(err) {
            console.log(err.data);

            // If the failure is due to lack of access, redirect to login page
            if (err.data.hasOwnProperty('authUrl')) {
                $scope.fbLogin();
            }
        });
    };
});
