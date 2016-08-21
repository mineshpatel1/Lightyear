app.controller('login', function($scope, $timeout, $http, $mdToast, $mdDialog) {
    $scope.toggleMode = function() {
        $scope.signUpMode = !$scope.signUpMode;
    }

    // Login function
    $scope.login = function() {
        if (!$scope.loading) {
            $scope.loading = true;
            if ($scope.email && $scope.password) {
                var credentials = {
                    'email': $scope.email,
                    'password': $scope.password
                };

                $http.post('/auth/local', credentials).then(function(response) {
                    $scope.loading = false;
                    navigate('/');
                }, function(err) {
                    $scope.loading = false;
                    showPopup('Login Failed', err.data);
                });
            } else {
                $scope.loading = false;
                showPopup('Login Failed', 'A valid email and password is required for login.');
            }
        }
    }

    $scope.register = function() {
        if (!$scope.loading) {
            if ($scope.email && $scope.password && $scope.displayName) {
                var credentials = {
                    'displayName' : $scope.displayName,
                    'email': $scope.email,
                    'password': $scope.password
                };

                $http.post('/auth/local/register', credentials).then(function(response) {
                    $scope.loading = false;
                    navigate('/');
                }, function(err) {
                    $scope.loading = false;
                    showPopup('Sign Up Failed', err.data);
                });
            } else {
                $scope.loading = false;
                showPopup('Sign Up Failed', 'A valid name, email and password is required for registration.')
            }
        }
    }

    function showSimpleToast() {
        var pinTo = { top: false, bottom: true, right: false, left: false };
        $mdToast.show(
            $mdToast.simple()
                .textContent('Simple Toast!')
                .position('bottom center')
                .highlightClass('md-warn')
                .hideDelay(3000)
        );
    };

    function showPopup(title, msg) {
        $mdDialog.show(
            $mdDialog.alert()
                .clickOutsideToClose(true)
                .title(title)
                .textContent(msg)
                .ariaLabel(title)
                .ok('Ok')
        );
    }

    function navigate(link) {
        window.location.href = link;
    };
});
