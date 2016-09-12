app.config(function($mdThemingProvider) {
	$mdThemingProvider.theme('default')
		.primaryPalette('indigo')
		.accentPalette('green', {
			default: '600'
		})
		.warnPalette('red', {
			default: '600'
		});
})

app.factory('Global', ['$http', '$q', '$mdDialog', function($http, $q, $mdDialog) {
	var fetchConnections = function(conns, success) {
		var authCalls = [];
		authCalls.push(checkGoogle(conns));
		authCalls.push(checkFB(conns));
		authCalls.push(checkTwitter(conns));
		authCalls.push(checkPostgre(conns));
		$q.all(authCalls).then(function() {
			success();
		});
	}

	// Gets Google user information and checks authentication
	function checkGoogle(conns) {
		var deferred = $q.defer();
		if (!conns.google.name) {
			$http.get('/google/user').then(function(response) {
				if (response.data) {
					conns.google = response.data;
					deferred.resolve();
				} else {
					deferred.resolve();
				}
			}, function() {
				deferred.resolve();
			});
		} else {
			deferred.resolve();
		}
		return deferred.promise;
	}

	// Gets Facebook user information and checks authentication
	function checkFB(conns) {
		var deferred = $q.defer();
		if (!conns.facebook.name) {
			$http.get('/facebook/user').then(function(response) {
				if (response.data) {
					conns.facebook = response.data;
					deferred.resolve();
				} else {
					deferred.resolve();
				}
			}, function() {
				deferred.resolve();
			});
		} else {
			deferred.resolve();
		}

		return deferred.promise;
	}

	// Gets Twitter user information and checks authentication
	function checkTwitter(conns) {
		var deferred = $q.defer();
		if (!conns.twitter.name) {
			$http.get('/twitter/user').then(function(response) {
				if (response.data) {
					conns.twitter = response.data;
					deferred.resolve();
				} else {
					deferred.resolve();
				}
			}, function() {
				deferred.resolve();
			});
		} else {
			deferred.resolve();
		}

		return deferred.promise;
	}

	// Gets PostgreSQL user information and checks authentication
	function checkPostgre(conns) {
		var deferred = $q.defer();
		if (!conns.postgre.name) {
			$http.get('/postgre/user').then(function(response) {
				if (response.data) {
					conns.postgre = response.data;
					deferred.resolve();
				} else {
					deferred.resolve();
				}
			}, function() {
				deferred.resolve();
			});
		} else {
			deferred.resolve();
		}

		return deferred.promise;
	}

	// Fetches the saved datasets for the user
	var fetchDatasets = function(callback) {
		$http.get('/datasets').then(function(response) {
			var datasets = [];
			response.data.forEach(function(ds) {
				var newDS = new sma.Dataset(false, ds.Type, ds.Name, ds.Query);
				datasets.push(newDS);
			});
			callback(datasets);
		}, function(response) {
			console.log(response.data);
			callback();
		})
	}

	var Global = {
		fetchConnections : fetchConnections,
		fetchDatasets : fetchDatasets
	};
	return Global;
}]);
