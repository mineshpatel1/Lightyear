app.config(function($mdThemingProvider, $mdDateLocaleProvider) {
	$mdThemingProvider.theme('default')
		.primaryPalette('indigo')
		.accentPalette('green', {
			default: '600'
		})
		.warnPalette('red', {
			default: '600'
		});

		$mdDateLocaleProvider.formatDate = function(date) {
			if (date) {
				// Convert to DD/MM/YYYY
				var year = date.getFullYear().toString();
				var month = (date.getMonth() + 1).toString();
				if (month.length == 1)
					month = '0' + month;
				var day = date.getDate().toString();
				if (day.length == 1)
					day = '0' + day;

				return day + '/' + month + '/' + year;
			} else {
				return '';
			}
		};
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

// Allows for dynamic filtering of objects based on a specific key and value to search
app.filter('objFilter', function() {
	return function(input, search) {
		if (!input) return input;
		if (!search) return input;
		var expected = ('' + search.val).toLowerCase();
		var result = {};
		angular.forEach(input, function(value, key) {
			var actual = ('' + value[search.key]).toLowerCase();
			if (actual.indexOf(expected) !== -1) {
				result[key] = value;
			}
		});
		return result;
	}
});

// Filters connector list based on the currently configured.
// Expects a connections object as the search parameter.
app.filter('connFilter', function() {
	return function(input, connections) {
		if (!input) return input;
		if (!connections) return input;
		var result = {};

		angular.forEach(input, function(value, key) {
			if (connections[key].name) {
				result[key] = value;
			}
		});
		return result;
	}
});
