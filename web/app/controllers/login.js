app.controller('login', function($scope, $timeout, $http, $q) {
    $scope.toggleMode = function() {
        $scope.signUpMode = !$scope.signUpMode;
    }
});
