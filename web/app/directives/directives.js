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
app.directive('editDataset', ['$http', function($http) {
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
            $scope.connectors = sma.Connectors;
			$scope.gaDims = sma.Config.GADims;
			$scope.gaMeasures = sma.Config.GAMeasures;

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

            $scope.preview = function() {
                $scope.loading = true;
                $scope.editDataset.Data = [];
                $scope.editDataset.Query.Criteria = [];
                $http.post('/query', $scope.editDataset).then(function(response) {
                    $scope.loading = false;
                    $scope.editDataset.Error = '';
                    $scope.editDataset.Data = response.data.rows;
                    $scope.editDataset.Query.Criteria = [];
					console.log(response.data);
                    response.data.Criteria.forEach(function(col) {
                        $scope.editDataset.Query.Criteria.push(new sma.BIColumn(col.Code, col.Name, col.DataType));
                    });
					console.log($scope.editDataset.Query.Criteria)
                }, function(response) {
                    $scope.loading = false;
                    $scope.editDataset.Error = 'Error: ' + response.data.msg;
                    console.log(response.data);
                });
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
					return (a[order] - b[order]) * dir;
				});
			}

		}
	}
}]);
