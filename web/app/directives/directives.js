// Dataset list
app.directive('datasets', ['$http', '$mdDialog', function($http, $mdDialog) {
	return {
		restrict: 'A',
		replace: true,
		templateUrl: '/app/templates/datasets.html',
		scope: {
			datasets: '=',
			edit: '=',
            loading: '=',
            connections: '='
		},
		link: function($scope, $elem, $attrs) {
            $scope.addDataset = function() {
                var dataset = new sma.Dataset($scope.connections);
                $scope.datasets.push(dataset);
                $scope.edit = dataset;
            }

            $scope.editDataset = function(dataset, i) {
                $scope.edit = dataset;
            }

            // Removes the dataset from the array
            $scope.removeDataset = function(ev, dataset, i) {
				// Appending dialog to document.body to cover sidenav in docs app
				var confirm = $mdDialog.confirm()
					.title('Would you like to delete this query?')
					.ariaLabel('Remove Query')
					.targetEvent(ev)
					.ok('Yes')
					.cancel('No');

				$mdDialog.show(confirm).then(function() {
					if ($scope.edit == dataset) {
	                    $scope.edit = {};
	                }
	                $scope.datasets.splice(i, 1);
				});
            }

            // Reverts datasets to those from the database
            $scope.revert = function() {
                $scope.loading = true;
                $http.get('/datasets').then(function(response) {
                    $scope.loading = false;
                    $scope.datasets = response.data;
                    $scope.edit = {};
                });
            }

            // Saves the datasets to MongoDB
            $scope.save = function() {
                $scope.loading = true;

                // Can't post large datasets, so copy the objects and ignore data
                var payload = [];
                $scope.datasets.forEach(function(ds) {
                    var newDS = angular.copy(ds);
                    newDS.Data = [];
                    payload.push(newDS);
                });
                $http.post('/datasets', payload).then(function(response) {
                    $scope.loading = false;
                }).then(function() {
                    $scope.loading = false;
                });
            }
		}
	}
}]);

// Edit/Preview Dataset
app.directive('editDataset', ['$http', '$mdDialog', function($http, $mdDialog) {
	return {
		restrict: 'A',
		replace: true,
		templateUrl: '/app/templates/editDataset.html',
		scope: {
			editDataset: '=',
            loading: '=',
            connections: '='
		},
		link: function($scope, $elem, $attrs) {
			console.log($scope.connections);
            $scope.connectors = sma.Connectors;
			$scope.gaDims = sma.Config.GADims;
			$scope.gaMeasures = sma.Config.GAMeasures;
			$scope.fbMeasures = sma.Config.FBMeasures;

			$scope.changeType = function(oldVal, newVal) {
				// Reset measures list if switching between Google and Facebook types
				if ((oldVal == 'fb' && newVal == 'ga') || (newVal == 'fb' && oldVal == 'ga')) {
					$scope.editDataset.Query.Measures = [];
				}
			}

			// Add Google Analytics dimension
			$scope.addGADim = function() {
				if ($scope.editDataset.Query.Dimensions.length <= 7) {
					$scope.editDataset.Query.Dimensions.push('ga:date');
				}
			}

			// Remove dimension from the list
			$scope.removeGADim = function(idx) {
				$scope.editDataset.Query.Dimensions.splice(idx, 1);
			}

			// Add Google Analytics metric
			$scope.addGAMeasure = function() {
				$scope.editDataset.Query.Measures.push('ga:sessions');
			}

			// Remove the metric from the list
			$scope.removeGAMeasure = function(idx) {
				$scope.editDataset.Query.Measures.splice(idx, 1);
			}

			// Add Facebook metric
			$scope.addFBMeasure = function() {
				$scope.editDataset.Query.Measures.push('page_impressions');
			}

			// Remove the metric from the list
			$scope.removeFBMeasure = function(idx) {
				$scope.editDataset.Query.Measures.splice(idx, 1);
			}

            $scope.preview = function(ev) {
				var error = false;
                $scope.loading = true;
                $scope.editDataset.Data = [];
                $scope.editDataset.Query.Criteria = [];

				// Caters for timezone offset
				function timezoneOffset(date) {
					return new Date(date.getTime() - date.getTimezoneOffset()*60000);
				}

				// Set access token if necessary
				if ($scope.editDataset.Type == 'facebook') {
					$scope.editDataset.Token = $scope.connections.facebook.pages.filter(function(page) {
						return page.id == $scope.editDataset.Query.FBPage;
					})[0].access_token;

					var grains = [];
					$scope.editDataset.Query.Measures.forEach(function(measure) {
						var grain = sma.Config.FBMeasures[measure].grain;
						if (grains.indexOf(grain) == -1) {
							grains.push(grain);
						}
					});
					if (grains.length > 1) {
						error = 'Metrics of mixed granularity chosen. Please choose a different combination.';
					}
				} else {
					$scope.editDataset.Token = '';
				}

				$scope.editDataset.Query.StartDate = timezoneOffset($scope.editDataset.Query.StartDate);
				$scope.editDataset.Query.EndDate = timezoneOffset($scope.editDataset.Query.EndDate);

				if (error) {
					$mdDialog.show(
					      $mdDialog.alert()
					        .clickOutsideToClose(true)
					        .title('Invalid Query')
					        .textContent(error)
					        .ariaLabel('Invalid Query')
					        .ok('Ok')
					        .targetEvent(ev)
					);
					$scope.loading = false;
				} else {
					$http.post('/query', $scope.editDataset).then(function(response) {
	                    $scope.loading = false;
	                    $scope.editDataset.Error = '';
	                    $scope.editDataset.Data = response.data.rows;
	                    $scope.editDataset.Query.Criteria = [];

	                    response.data.Criteria.forEach(function(col) {
	                        $scope.editDataset.Query.Criteria.push(new sma.BIColumn(col.Code, col.Name, col.DataType));
	                    });

	                }, function(response) {
	                    $scope.loading = false;
	                    $scope.editDataset.Error = 'Error: ' + response.data.msg;
	                    console.log(response.data);
	                });
				}
            }

            $scope.test = function() {
                console.log($scope.editDataset);
            }
		}
	}
}]);

// Dataset list
app.directive('previewDataset', [function() {
	return {
		restrict: 'A',
		replace: true,
		templateUrl: '/app/templates/previewDataset.html',
		scope: {
			dataset: '='
		},
		link: function($scope, $elem, $attrs) {
            $scope.rowLimit = 5;
            $scope.page = 1;
			$scope.reorderQuery = function(col) {
				console.log(col);
			}

			$scope.reorderQuery = function(order) {
				var dir = 1;
				if (order.indexOf('-') == 0) {
					dir = -1;
					order = order.substr(1, order.length);
				}
				$scope.dataset.Data = $scope.dataset.Data.sort(function(a, b) {
					if (dir == -1) {
						return d3.descending(a[order], b[order]);
					} else {
						return d3.ascending(a[order], b[order]);
					}
				});
			}

		}
	}
}]);
