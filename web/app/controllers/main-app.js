app.controller('main-app', function($scope, $timeout, $http) {
    function navigate(link) {
        window.location.href = link;
    }

    $scope.googleQuery = function() {
        $http.get('/google/analytics').then(function(response) {
            $scope.gaSessions = response.data[0];
        }, function(err) {
            // If the failure is due to lack of access, redirect to login page
            if (err.data.error.indexOf('No access') > -1) {
                navigate(err.data.authUrl);
            }
        });
    }
});
