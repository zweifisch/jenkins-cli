# jenkins-cli

``` sh
npm i -g @zf/jenkins-cli
```

## projects

```sh
export JENKINS_URL=http://admin:password@localhost:8080
jenkins list

# filter by status
jenkins list --building

# filter by name
jenkins list <partialname>

# enable/disable
jenkins enable <project>
jenkins disable <project>
```

## builds

``` sh
# trigger build
jenkins build <project>

# list builds of project
jenkins builds <project>

# get project defination
jenkins dump <project>
```

## artifacts

```sh
# list artifacts of the last stable build
jenkins artifacts <project>

# download artifacts
jenkins donwload <project>

# only download deb packages
jenkins donwload <project> --ext deb
```

## multibranch project

```sh
jenkins download <project> <branch>
```

## export/import

```sh
jenksin export --path <myfolder>

jenksin import --path <myfolder>
```
