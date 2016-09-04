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
		        }, genError);
			}

			$scope.gaRevoke = function() {
				$scope.loading = true;
		        $http.get('/auth/google/revoke').then(function(response) {
					$scope.loading = false;
		            $scope.connections.google = {};
		        }, genError);
		    }

			$scope.fbLogin = function() {
				$http.get('/auth/facebook').then(function(response) {
		            window.location.href = response.data;
		        }, genError);
			}

			$scope.fbRevoke = function() {
				$scope.loading = true;
				$http.get('/auth/facebook/revoke').then(function(response) {
					$scope.loading = false;
		            $scope.connections.facebook = {};
		        }, genError);
			}

			$scope.twitterRevoke = function() {
				$scope.connections.twitter = {};
			}

			$scope.twitterLogin = function() {
				$http.get('/auth/twitter').then(function(response) {
					window.location.href = response.data;
				}, genError);
			}

			function genError() {
				$scope.loading = false;
			}

			// Check all of the authentication adn retrieve the necessary user data
			function init() {
				$scope.loading = true;
				Global.fetchConnections($scope.connections, function() {
					$scope.initialised = true;
					$scope.loading = false;
				})
			}

			init();
		}
	}
}]);
