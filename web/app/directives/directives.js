// Connectivity and accounts directive
app.directive('connections', ['$http', '$q', 'Global', function($http, $q, Global) {
	return {
		restrict: 'A',
		replace: true,
		templateUrl: '/app/directives/templates/connections.html',
		scope: {
			connections: '='
		},
		link: function($scope, $elem, $attrs) {
			$scope.logins = {};
			$scope.loading = false, $scope.initialised = false;

			$scope.gaLogin = function() {
		        $http.get('/auth/google').then(function(response) {
		            window.location.href = response.data;
		        }, googleError);
			}

			$scope.gaRevoke = function() {
		        $http.get('/auth/google/revoke').then(function(response) {
		            $scope.connections.google = {};
		        }, googleError);
		    }

			// If the failure is due to lack of access, redirect to login page
		    function googleError(err) {
		        console.log(err.data);
		        if (err.data.hasOwnProperty('authUrl')) { // Authenticate if necessary
		            window.location.href = err.data.authUrl;
		        }
		    }

			// Check all of the authentication adn retrieve the necessary user data
			function init() {
				$scope.loading = true;
				// if (!$scope.connections.google.name) {
				// 	$http.get('/google/user').then(function(response) {
				// 		if (response.data) {
				// 			$scope.connections.google = response.data;
				// 			$http.get('/google/analytics/profiles').then(function(response) {
				// 				$scope.connections.google.profiles = response.data;
				// 				$scope.connections.google.profile = $scope.connections.google.defaultProfileID || response.data[0].id;
				// 				$scope.initialised = true;
				// 				$scope.loading = false;
				// 			}, googleError);
				// 		} else {
				// 			$scope.initialised = true;
				// 			$scope.loading = false;
				// 		}
				// 	}, googleError);
				// } else {
				// 	$scope.initialised = true;
				// 	$scope.loading = false;
				// }
				Global.fetchConnections($scope.connections, function() {
					$scope.initialised = true;
					$scope.loading = false;
				})
			}

			init();
		}
	}
}]);
