(function() {

	var TTStats = angular.module('TTStats', []);

	TTStats.config(function($routeProvider, $locationProvider) {

		$routeProvider.when('/player/:playerId', {
			templateUrl: 'templates/player.html',
			controller: 'PlayerCtrl'
		});

		$routeProvider.when('/new-match', {
			templateUrl: 'templates/new-match.html',
			controller: 'NewMatchCtrl'
		});

		$routeProvider.when('/match/:matchId', {
			templateUrl: 'templates/match.html',
			controller: 'MatchCtrl'
		});

		$routeProvider.when('/stats', {
			templateUrl: 'templates/stats.html',
			controller: 'StatsCtrl'
		});

		$routeProvider.otherwise({redirectTo: '/stats'});

		// configure html5 to get links working on jsfiddle
		$locationProvider.html5Mode(false);

	});

	TTStats.factory('$store', function($q, $rootScope) {

		var db = Pouch('ttstats');
		var store = {};

		store.MATCH = 'match';
		store.PLAYER = 'player';

		function resolveDeffered(defer, err, res) {
			$rootScope.$apply(function() {
				if(err) return defer.reject(err);
				defer.resolve(res);
			})
		}

		function onlyPlayers(doc) {
			if(doc.type === 'player') {
				emit(doc._id, doc);
			}
		}

		function onlyMatches(doc) {
			if(doc.type === 'match') {
				emit(doc._id, doc);
			}
		}

		store.newPlayer = function() {
			return {
				type: store.PLAYER,
				properties: {
					"name": ""
				}
			}
		};

		store.newMatch = function() {
			return {
				type: store.MATCH
			}
		};

		store.save = function(doc) {
			var deferred = $q.defer();
			db[doc._id ? 'put' : 'post'](doc, resolveDeffered.bind(null, deferred));
			return deferred.promise;
		}

		store.get = function(oid) {
			var deferred = $q.defer();
			db.get(oid, resolveDeffered.bind(null, deferred));
			return deferred.promise;
		}

		store.getAllPlayers = function() {
			var deferred = $q.defer();
			db.query({map: onlyPlayers}, resolveDeffered.bind(null, deferred));
			return deferred.promise;
		};

		store.getAllMatches = function() {
			var deferred = $q.defer();
			db.query({map: onlyMatches}, resolveDeffered.bind(null, deferred));
			return deferred.promise;
		};

		return store;

	});

	TTStats.controller('AppCtrl', function($rootScope, $location) {
		$rootScope.isViewActive = function(path) {
			return $location.$$path === path ? 'active' : '';
		}
	});


	function pluckDocs(row) {
		return row.value;
	}

	TTStats.controller('StatsCtrl', function($scope, $store) {
		$scope.matches = [];
		$scope.players = [];
		$scope.playersNames = {};
		$store.getAllMatches().then(function(res) {
			$scope.matches = res.rows.map(pluckDocs);
		});
		$store.getAllPlayers().then(function(res) {
			$scope.players = res.rows.map(pluckDocs).forEach(function(p) {
				$scope.playersNames[p._id] = p.properties.name;
			});
		});

		$scope.getPlayerName = function(oid) {
			return $scope.playersNames[oid] || "Loading data...";
		};
	});

	TTStats.controller('PlayerCtrl', function($scope, $store, $location, $routeParams) {

		function initProperties() {
			$scope.availableProperties = angular.copy($scope.player.properties);
			$scope.properties = angular.copy($scope.player.properties);
		}

		if($routeParams.playerId) {
			$store.get($routeParams.playerId).then(function(player) {
				$scope.player = player;
				initProperties();
			});
		} else {
			$scope.player = $store.newPlayer();
			initProperties();
		}

		$scope.addNewProperty = function() {
			if(!($scope.newProperty in $scope.availableProperties)) {
				$scope.availableProperties[$scope.newProperty] = "";
				$scope.properties[$scope.newProperty] = "";
				$scope.newProperty = "";
			}
		};

		$scope.saveNewPlayer = function() {
			$scope.player.properties = $scope.properties;
			$store.save($scope.player).then(function() {
				$location.path('/new-match')
			});
		};

	});

	TTStats.controller('NewMatchCtrl', function($rootScope, $scope, $store, $location) {

		$store.getAllPlayers().then(function(res) {
			$scope.availablePlayers = res.rows.map(pluckDocs);
		});

		$scope.startMatch = function() {
			var match = $store.newMatch();
			match.playerOne =  $scope.playerOne._id;
			match.playerTwo =  $scope.playerTwo._id;
			match.plays = [];
			$store.save(match).then(function(res) {
				$location.path('/match/'+res.id);
			});
		};

		$scope.createNewPlayer = function() {
			$location.path('/new-player')
		};

	});

	TTStats.controller('MatchCtrl', function($scope, $routeParams, $store, $location) {

		$store.get($routeParams.matchId).then(function(match) {
			$scope.match = match;
			$store.get(match.playerOne).then(function(doc) {
				$scope.playerOne = doc;
			});
			$store.get(match.playerTwo).then(function(doc) {
				$scope.playerTwo = doc;
			});
		});

		$scope.addPlay = function() {
			$scope.match.plays.push({
				looser: $scope.looser._id,
				shots: $scope.shots
			});
		};

		$scope.getPlayerName = function(oid) {
			if($scope.playerOne && $scope.playerTwo) {
				return oid === $scope.playerOne._id ? $scope.playerOne.properties.name : $scope.playerTwo.properties.name;
			} else return "Loading data...";
		}

		$scope.isShotSelected = function(shots) {
			return shots === $scope.shots;
		};

		$scope.isPlayerSelected = function(player) {
			return player === $scope.looser;
		};

		$scope.endMatch = function() {
			$scope.match.ended = true;
			$store.save($scope.match).then(function() {
				$location.path('/stats');
			})
		};

	});

}());