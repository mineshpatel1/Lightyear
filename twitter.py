#!/usr/bin/python

import lyf

def main():
	api = lyf.twitter_api()
	me = api.me() # Details about me
	
	print('Followers: %s' % me.followers_count)
	print('Following: %s' % me.friends_count)
	print('Tweets: %s' % me.statuses_count)

if __name__ == '__main__':
	main()