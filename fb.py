#!/usr/bin/python

import lyf
import requests

def main():
	results = lyf.fb_query('name,likes,videos{created_time,likes}')
	print('Page Name: %s' % results['name'])
	print('Likes: %s' % results['likes'])
	print('Total Videos: %s' % len(results['videos']['data']))
	
	totalVidLikes = 0
	for vid in results['videos']['data']:
		totalVidLikes += len(vid['likes']['data'])
	print('Total Video likes: %s' % totalVidLikes)
	
if __name__ == '__main__':
	main()