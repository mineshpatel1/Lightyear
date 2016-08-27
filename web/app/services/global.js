app.factory('Global', ['$http', '$q', function($http, $q) {
	var fetchConnections = function(conns, success) {
		if (!conns.google.name) {
			$http.get('/google/user').then(function(response) {
				if (response.data) {
					conns.google = response.data;
					success();
				} else {
					success();
				}
			}, success);
		} else {
			success();
		}
	}

	function checkGoogle(conns) {
		var deferred = $q.defer();
	}

	var Global = {
		fetchConnections : fetchConnections
	};
	return Global;
}]);
